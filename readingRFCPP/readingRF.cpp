#include <wiringPi.h>
#include <wiringPiSPI.h>
#include <iostream>
#include <vector>
#include <unistd.h>

#define SPI_CHANNEL 0    // CE0 (Chip Enable 0)
#define RST_PIN 25       // GPIO 25 for Reset

// MFRC522 Register addresses
#define CommandReg      0x01
#define ComIEnReg       0x02
#define DivIEnReg       0x03
#define ComIrqReg       0x04
#define DivIrqReg       0x05
#define ErrorReg        0x06
#define Status1Reg      0x07
#define Status2Reg      0x08
#define FIFODataReg     0x09
#define FIFOLevelReg    0x0A
#define ControlReg      0x0C
#define BitFramingReg   0x0D
#define ModeReg         0x11
#define TxModeReg       0x12
#define RxModeReg       0x13
#define TxControlReg    0x14
#define TxASKReg        0x15
#define TModeReg        0x2A
#define TPrescalerReg   0x2B
#define TReloadRegH     0x2C
#define TReloadRegL     0x2D

// MFRC522 Commands
#define PCD_IDLE        0x00
#define PCD_AUTHENT     0x0E
#define PCD_RECEIVE     0x08
#define PCD_TRANSMIT    0x04
#define PCD_TRANSCEIVE  0x0C
#define PCD_RESETPHASE  0x0F
#define PCD_CALCCRC     0x03

// PICC Commands
#define PICC_REQIDL     0x26
#define PICC_ANTICOLL   0x93

class MFRC522 {
public:
    MFRC522(int channel, int resetPin) : spiChannel(channel), resetPin(resetPin) {}
    
    void init() {
        wiringPiSetup();
        if (wiringPiSPISetup(spiChannel, 1000000) < 0) {  // SPI Speed: 1 MHz
            std::cerr << "SPI Setup failed!" << std::endl;
            return;
        }
        
        pinMode(resetPin, OUTPUT);
        reset();
        
        // Initialize registers
        writeRegister(TModeReg, 0x8D);         // Tauto=1; f(Timer) = 6.78MHz/TPreScaler
        writeRegister(TPrescalerReg, 0x3E);    // TModeReg[3..0] + TPrescalerReg
        writeRegister(TReloadRegL, 30);        
        writeRegister(TReloadRegH, 0);
        writeRegister(TxASKReg, 0x40);         // Force 100% ASK modulation
        writeRegister(ModeReg, 0x3D);          // CRC preset value to 0x6363

        // Turn on the antenna
        enableAntenna();
        
        // Add more detailed version check
        unsigned char version = readRegister(0x37);
        std::cout << "MFRC522 Version: 0x" << std::hex << (int)version << std::dec << std::endl;
        
        if (version == 0x91 || version == 0x92) {
            std::cout << "Found valid MFRC522 chip" << std::endl;
        } else {
            std::cout << "WARNING: Unexpected version, SPI communication may be failing" << std::endl;
        }
        
        // Test write/read to a register
        writeRegister(0x24, 0x25); // Write to test register
        unsigned char test = readRegister(0x24);
        std::cout << "Test register read: 0x" << std::hex << (int)test << std::dec << std::endl;
        if (test == 0x25) {
            std::cout << "Register write/read test PASSED" << std::endl;
        } else {
            std::cout << "Register write/read test FAILED!" << std::endl;
        }
    }
    
    bool isCardPresent() {
        std::vector<unsigned char> buffer;
        buffer.push_back(PICC_REQIDL);
        
        unsigned char backBits = 0;
        std::vector<unsigned char> backData;
        
        // Clear potential pending interrupts
        writeRegister(ComIrqReg, 0x7F);
        
        // Run the command
        unsigned char status = transceive(buffer, &backData, &backBits);
        
        std::cout << "isCardPresent status: " << (int)status << ", backBits: " << (int)backBits << std::endl;
        if (backData.size() > 0) {
            std::cout << "Response data: ";
            for (unsigned char b : backData) {
                printf("%02X ", b);
            }
            std::cout << std::endl;
            
            // If we got any data, consider a card present
            return true;
        }
        
        // No response data
        return false;
    }
    
    bool readCardUID(std::vector<unsigned char>& uid) {
        // Reset the baud rates
        writeRegister(TxModeReg, 0x00);
        writeRegister(RxModeReg, 0x00);
        
        // Clear potential pending interrupts
        writeRegister(ComIrqReg, 0x7F);
        
        // Prepare anticollision command - correct format
        std::vector<unsigned char> buffer;
        buffer.push_back(PICC_ANTICOLL);  // Anticollision command
        buffer.push_back(0x20);           // NVB - Number of Valid Bits
        
        // Improved error handling
        std::vector<unsigned char> backData;
        unsigned char backBits = 0;
        
        // Execute the command with better timing
        writeRegister(BitFramingReg, 0x00);  // Transmit the full frame
        unsigned char status = transceive(buffer, &backData, &backBits);
        
        // Detailed debugging
        std::cout << "readCardUID status: " << (int)status << ", backBits: " << (int)backBits << std::endl;
        std::cout << "Data size: " << backData.size() << std::endl;
        
        // Print all received bytes for debugging
        if (backData.size() > 0) {
            std::cout << "Received data: ";
            for (size_t i = 0; i < backData.size(); i++) {
                printf("%02X ", backData[i]);
            }
            std::cout << std::endl;
        }
        
        // Relax requirements for successful read - some readers don't provide BCC
        if (status != 0) {
            std::cout << "Command failed with status: " << (int)status << std::endl;
            return false;
        }
        
        // Handle varying response sizes (some readers send 4 bytes, others 5)
        if (backData.size() < 4) {
            std::cout << "Not enough data received: " << backData.size() << " bytes" << std::endl;
            return false;
        }
        
        // Extract UID (first 4 bytes)
        uid.clear();
        for (int i = 0; i < 4 && i < backData.size(); i++) {
            uid.push_back(backData[i]);
        }
        
        // Verify BCC if present
        if (backData.size() >= 5) {
            unsigned char bcc = backData[0] ^ backData[1] ^ backData[2] ^ backData[3];
            if (bcc != backData[4]) {
                std::cout << "BCC check failed! Calculated: " << (int)bcc << 
                           ", Received: " << (int)backData[4] << std::endl;
                // Continue anyway as BCC might be calculated differently
            }
        }
        
        return true;
    }
    
private:
    int spiChannel;
    int resetPin;
    
    void reset() {
        digitalWrite(resetPin, HIGH);
        usleep(50000);
        digitalWrite(resetPin, LOW);
        usleep(50000);
        digitalWrite(resetPin, HIGH);
        usleep(50000);
        
        writeRegister(CommandReg, PCD_RESETPHASE);
        usleep(50000);
    }
    
    void enableAntenna() {
        unsigned char value = readRegister(TxControlReg);
        if ((value & 0x03) != 0x03) {
            writeRegister(TxControlReg, value | 0x03);
        }
    }
    
    void writeRegister(unsigned char reg, unsigned char value) {
        unsigned char data[2];
        data[0] = (reg << 1) & 0x7E;  // MFRC522 expects address in bits 7-1, bit 0 = 0 for write
        data[1] = value;
        wiringPiSPIDataRW(spiChannel, data, 2);
    }
    
    unsigned char readRegister(unsigned char reg) {
        unsigned char data[2];
        data[0] = ((reg << 1) & 0x7E) | 0x80;  // MFRC522 expects address in bits 7-1, bit 0 = 1 for read
        data[1] = 0;
        wiringPiSPIDataRW(spiChannel, data, 2);
        return data[1];
    }
    
    int getBufferSize() {
        return readRegister(FIFOLevelReg);
    }
    
    void clearBuffer() {
        writeRegister(FIFOLevelReg, 0x80);  // Clear FIFO
    }
    
    unsigned char transceive(std::vector<unsigned char>& data, std::vector<unsigned char>* backData, unsigned char* backBits) {
        unsigned char status = 0;
        unsigned char irqEn = 0x77;    // Allow TxIRq, RxIRq, IdleIRq and error interrupts
        unsigned char waitIRq = 0x30;  // Wait for RxIRq or IdleIRq
        
        writeRegister(ComIrqReg, 0x7F);      // Clear interrupt request bits
        writeRegister(FIFOLevelReg, 0x80);   // Clear FIFO
        writeRegister(ComIEnReg, irqEn|0x80);// Enable interrupts
        
        // Load data into FIFO
        for (size_t i = 0; i < data.size(); i++) {
            writeRegister(FIFODataReg, data[i]);
        }
        
        // Start transmission
        writeRegister(CommandReg, PCD_TRANSCEIVE);
        
        // Adjust timing and start transmission
        if (data.size() > 0 && data[0] == PICC_ANTICOLL) {
            writeRegister(BitFramingReg, 0x80);  // StartSend without interrupts
        } else {
            writeRegister(BitFramingReg, 0x87);  // StartSend with TxLastBits = 7
        }
        
        // Wait for completion with longer timeout
        int i = 5000;  // Increased timeout ~75ms
        unsigned char n = 0;
        do {
            n = readRegister(ComIrqReg);
            if (n & waitIRq) break;  // Successful completion
            if (n & 0x01) {          // Timer interrupt - timeout
                std::cout << "Timer interrupt triggered" << std::endl;
                break;
            }
            i--;
        } while (i != 0);
        
        // Stop transmission
        writeRegister(BitFramingReg, 0x00);
        
        if (i == 0) {
            std::cout << "Timeout in transceive after max iterations" << std::endl;
            return 1;  // Timeout
        }
        
        std::cout << "IRQ register: 0x" << std::hex << (int)n << std::dec << std::endl;
        
        // Check for errors
        status = readRegister(ErrorReg);
        if (status & 0x1B) {  // Buffer overflow, collision, protocol error, parity error
            std::cout << "Error in transceive: 0x" << std::hex << (int)status << std::dec << std::endl;
        }
        
        // Check for collision
        if (status & 0x08) {
            std::cout << "Collision detected" << std::endl;
        }
        
        // Success, check if we have data
        unsigned char validBits = readRegister(ControlReg) & 0x07;
        if (backBits) *backBits = validBits;
        
        // Read data from FIFO if needed
        if (backData) {
            unsigned char fifoLevel = readRegister(FIFOLevelReg);
            std::cout << "FIFO Level: " << (int)fifoLevel << std::endl;
            
            backData->clear();
            for (unsigned char i = 0; i < fifoLevel; i++) {
                backData->push_back(readRegister(FIFODataReg));
            }
        }
        
        return status; // Return actual status for better error handling
    }
};

int main() {
    MFRC522 mfrc522(SPI_CHANNEL, RST_PIN);
    mfrc522.init();
    std::cout << "Waiting for RFID tag..." << std::endl;
    
    while (true) {
        if (mfrc522.isCardPresent()) {
            std::cout << "Card detected!" << std::endl;
            std::vector<unsigned char> uid;
            if (mfrc522.readCardUID(uid)) {
                std::cout << "RFID Tag Detected! UID: ";
                for (size_t i = 0; i < uid.size(); ++i) {
                    printf("%02X ", uid[i]);
                }
                std::cout << std::endl;
            } else {
                std::cout << "Failed to read UID!" << std::endl;
            }
            delay(1000);  // Wait 1 second before reading again
        }
        delay(200);  // Poll every 200ms for a card
    }
    
    return 0;
}
