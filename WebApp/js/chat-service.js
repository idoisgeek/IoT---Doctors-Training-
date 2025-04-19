// ChatGPT API Service
let lastRequestTime = 0;
const minRequestInterval = 1000; // Minimum 1 second between requests

function isChatWindowOpen() {
    const chatWindow = document.getElementById('chatWindow');
    return chatWindow && chatWindow.classList.contains('active');
}

window.callChatGPT = async function(messages, retryCount = 0) {
    const maxRetries = 2; // Reduced max retries
    const baseDelay = 2000; // Increased base delay to 2 seconds

    try {
        // Stop if chat window is closed
        if (!isChatWindowOpen()) {
            throw new Error('Chat window closed');
        }

        // Ensure minimum time between requests
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < minRequestInterval) {
            await new Promise(resolve => setTimeout(resolve, minRequestInterval - timeSinceLastRequest));
        }

        // Create AbortController for this request
        const controller = new AbortController();
        window.currentApiCall = controller;

        console.log(`Attempt ${retryCount + 1} of ${maxRetries + 1}`);
        const response = await fetch('http://localhost:3000/api/chat', {
            signal: controller.signal,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ messages })
        });

        lastRequestTime = Date.now(); // Update last request time

        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 429) {
                const retryAfter = Math.max(data.retryAfter || 60, 5); // Minimum 5 second wait
                if (retryCount < maxRetries && isChatWindowOpen()) {
                    const delay = Math.min(retryAfter * 1000, baseDelay * Math.pow(2, retryCount));
                    console.log(`Rate limited. Waiting ${delay/1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return await window.callChatGPT(messages, retryCount + 1);
                }
                throw new Error(`OpenAI API rate limit reached. Please wait a minute before trying again.`);
            }
            throw new Error(data.error || `Error: ${response.status} - ${response.statusText}`);
        }

        // Final check before returning response
        if (!isChatWindowOpen()) {
            throw new Error('Chat window closed');
        }

        return data.content;
    } catch (error) {
        if (!isChatWindowOpen()) {
            throw new Error('Chat window closed');
        }

        if (error.name === 'AbortError') {
            throw new Error('Request was cancelled');
        }

        if (error.message.includes('rate limit') && retryCount < maxRetries && isChatWindowOpen()) {
            const delay = baseDelay * Math.pow(2, retryCount);
            console.log(`Retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return await window.callChatGPT(messages, retryCount + 1);
        }

        console.error('Error:', error);
        throw error;
    }
}
