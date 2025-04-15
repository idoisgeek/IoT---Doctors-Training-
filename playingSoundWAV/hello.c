#include <iostream>
#include <pigpio.h>
#include "MFRC522.h"

#define RST_PIN 25   // Reset pin
#define SS_PIN 8     // Chip Select pin

MFRC522 mfrc522(SS_PIN, RST_PIN);  // Create MFRC522 instance

void readRFID() {
    if (!mfrc522.PICC_IsNewCardPresent()) {
        return; // No new card detected
    }

    if (!mfrc522.PICC_ReadCardSerial()) {
        return; // Failed to read card serial
    }

    std::cout << "Card UID: ";
    for (byte i = 0; i < mfrc522.uid.size; i++) {
        std::cout << (int)mfrc522.uid.uidByte[i] << " ";
    }
    std::cout << std::endl;
    mfrc522.PICC_HaltA();
}

int main() {
    if (gpioInitialise() < 0) {
        std::cerr << "pigpio initialization failed!" << std::endl;
        return 1;
    }

    mfrc522.PCD_Init();  // Initialize the MFRC522 module

    std::cout << "Scan a card..." << std::endl;

    while (true) {
        readRFID();
        gpioSleep(PI_TIME_RELATIVE, 0, 500000);  // Delay for half a second
    }

    gpioTerminate();  // Clean up pigpio library
    return 0;
}



/*
#include <stdio.h>
#include <SDL2/SDL.h>
#include <SDL2/SDL_mixer.h>

#define WAV_FILE "2530_AV.wav"  // Replace with your actual file path


int main() {
    // Initialize SDL
    if (SDL_Init(SDL_INIT_AUDIO) < 0) {
        printf("SDL could not initialize! SDL_Error: %s\n", SDL_GetError());
        return 1;
    }

    // Initialize SDL_mixer
    if (Mix_OpenAudio(44100, MIX_DEFAULT_FORMAT, 2, 2048) < 0) {
        printf("SDL_mixer could not initialize! Mix_Error: %s\n", Mix_GetError());
        SDL_Quit();
        return 1;
    }

    // Load WAV file
    Mix_Chunk *sound = Mix_LoadWAV(WAV_FILE);
    if (!sound) {
        printf("Failed to load sound! Mix_Error: %s\n", Mix_GetError());
        Mix_CloseAudio();
        SDL_Quit();
        return 1;
    }

    // Play sound on channel 1
    int channel = Mix_PlayChannel(-1, sound, 0);
    if (channel == -1) {
        printf("Failed to play sound! Mix_Error: %s\n", Mix_GetError());
        Mix_FreeChunk(sound);
        Mix_CloseAudio();
        SDL_Quit();
        return 1;
    }

    // Wait for 5 seconds
    SDL_Delay(5000);

    // Stop the sound
    Mix_HaltChannel(channel);
    printf("Playback stopped after 5 seconds.\n");

    // Clean up
    Mix_FreeChunk(sound);
    Mix_CloseAudio();
    SDL_Quit();

    return 0;
}


	int main(){

		printf("hello world!\n");
		system("aplay 2530_AV.wav");
		sleep(3);
		system("killall aplay");
		return 0;
}*/
