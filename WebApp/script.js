// Initialize storage service
const storageService = new StorageService('file'); // or 'online' for remote storage
let prompts = [];
let currentConversation = [];
let isProcessing = false;
let currentApiCall = null;
let currentSimulationPrompt = null; // To store the selected simulation prompt

document.addEventListener('DOMContentLoaded', () => {
    // Menu and section functionality
    const menuItems = document.querySelectorAll('.side-menu nav a');
    const sections = document.querySelectorAll('.content-section');

    // Debug: Log all available sections
    console.log('Available sections:', Array.from(sections).map(s => s.getAttribute('data-section')));

    function showSection(sectionId) {
        // First hide all sections
        sections.forEach(section => {
            section.classList.remove('active');
        });

        // Find and show the target section
        const targetSection = document.querySelector(`.content-section[data-section="${sectionId}"]`);
        if (targetSection) {
            targetSection.classList.add('active');
            console.log(`Showing section: ${sectionId}`);
        } else {
            console.log(`Section not found: ${sectionId}`);
        }

        // If navigating to the "Start Simulation" section, populate the dropdown
        if (sectionId === 'start-simulation') {
            populateSimulationDropdown();
        }
        // If navigating to the "Start Simulation" section, populate the dropdown
        if (sectionId === 'services') {
          populateCaseDropdown();
        }
    }

    // Show home section by default
    showSection('home');

    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation(); // Prevent event bubbling

            // Update active menu item
            menuItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            // Show corresponding section
            const sectionId = this.getAttribute('data-section');
            console.log(`Menu item clicked: ${sectionId}`);
            showSection(sectionId);
        });
    });

    // Prompt functionality (for Manage Simulations section)
    const promptNameInput = document.getElementById('promptName');
    const promptInput = document.getElementById('promptInput');
    const createPromptBtn = document.getElementById('createPrompt');
    const promptsList = document.getElementById('promptsList');
    const searchHistory = document.getElementById('searchHistory');
    const sortHistory = document.getElementById('sortHistory');
    const saveEditBtn = document.getElementById('saveEditPrompt');
    const editPromptTextInput = document.getElementById('editPromptText');

    // Save prompts using storage service
    async function savePrompts() {
        try {
            await storageService.savePrompts(prompts);
        } catch (error) {
            console.error('Error saving prompts:', error);
            alert('Failed to save prompts. Please try again.');
        }
    }

    // Create a new prompt
    async function createPrompt(name, text) {
        const prompt = {
            id: Date.now(),
            name: name,
            text: text,
            date: new Date().toISOString(),
        };
        prompts.unshift(prompt); // Add to beginning of array
        await savePrompts();
        renderPrompts();
        // After creating a prompt, update the dropdown in "Start Simulation" if visible
        const startSimulationSection = document.getElementById('start-simulation-section');
        if (startSimulationSection && startSimulationSection.classList.contains('active')) {
            populateSimulationDropdown();
        }
    }

    // Save the edited prompt (description only)
    async function saveEditedPrompt() {
      const selectedId = Number(editPromptSelect.value);
      const updatedText = editPromptTextInput.value.trim();

      if (!selectedId || !updatedText) {
        alert("Missing selected case or updated description");
        return;
      }

      prompts = prompts.map(prompt => {
          if (prompt.id === selectedId) {
              return {
                  ...prompt,
                  text: updatedText,
                  date: new Date().toISOString()
              };
          }
          return prompt;
      });

      await savePrompts();
      renderPrompts();

      // Update the dropdown in "Start Simulation" if visible
      const startSimulationSection = document.getElementById('start-simulation-section');
      if (startSimulationSection && startSimulationSection.classList.contains('active')) {
          populateSimulationDropdown();
      }

      populateCaseDropdown(); // Refresh the edit dropdown if names changed elsewhere
      editPromptTextInput.value = '';

    }

    saveEditBtn.addEventListener('click', saveEditedPrompt);

    // Delete confirmation handling
    const confirmDialog = document.getElementById('confirmDialog');
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    const cancelDeleteBtn = document.getElementById('cancelDelete');
    let promptToDelete = null;

    window.confirmDelete = function(id, name) {
        promptToDelete = id;
        const message = document.querySelector('.confirm-dialog-content p');
        message.textContent = `Are you sure you want to delete "${name}"?`;
        confirmDialog.classList.add('active');
    };

    confirmDeleteBtn.addEventListener('click', async () => {
        if (promptToDelete !== null) {
            await deletePrompt(promptToDelete);
            promptToDelete = null;
        }
        confirmDialog.classList.remove('active');
    });

    cancelDeleteBtn.addEventListener('click', () => {
        promptToDelete = null;
        confirmDialog.classList.remove('active');
    });

    async function deletePrompt(id) {
        try {
            await storageService.deletePrompt(id);
            prompts = prompts.filter(prompt => prompt.id !== id);
            renderPrompts();
            // After deleting a prompt, update the dropdown in "Start Simulation" if visible
            const startSimulationSection = document.getElementById('start-simulation-section');
            if (startSimulationSection && startSimulationSection.classList.contains('active')) {
                populateSimulationDropdown();
            }
        } catch (error) {
            console.error('Error deleting prompt:', error);
            alert('Failed to delete prompt. Please try again.');
        }
    }

    // Format date for display
    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    // Create HTML for a single prompt in the Manage Simulations list
    function createPromptElement(prompt) {
        const div = document.createElement('div');
        div.className = 'prompt-item';
        div.innerHTML = `
            <div class="prompt-content">
                <div class="prompt-name">${prompt.name || 'Unnamed Prompt'}</div>
                <div class="prompt-text">${prompt.text}</div>
                <div class="prompt-date">${formatDate(prompt.date)}</div>
            </div>
            <div class="prompt-actions">
                <button class="btn-delete" onclick="confirmDelete(${prompt.id}, '${(prompt.name || 'Unnamed Prompt').replace(/'/g, "\\'")}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        return div;
    }

    // Filter and sort prompts for Manage Simulations
    function getFilteredAndSortedPrompts() {
        const searchTerm = searchHistory.value.toLowerCase();
        const sortOrder = sortHistory.value;

        let filtered = prompts.filter(prompt =>
            prompt.text.toLowerCase().includes(searchTerm) ||
            (prompt.name && prompt.name.toLowerCase().includes(searchTerm))
        );

        if (sortOrder === 'oldest') {
            filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
        }

        return filtered;
    }

    // Render all prompts in the Manage Simulations list
    function renderPrompts() {
        const filteredPrompts = getFilteredAndSortedPrompts();
        promptsList.innerHTML = '';
        filteredPrompts.forEach(prompt => {
            promptsList.appendChild(createPromptElement(prompt));
        });
    }

    // Storage type change handler
    const storageTypeSelect = document.getElementById('storageType');

    storageTypeSelect.addEventListener('change', (e) => {
        const newType = e.target.value;
        storageService.setStorageType(newType);
        loadPrompts(); // Reload prompts from new storage
    });

    // Event Listeners for Manage Simulations
    createPromptBtn.addEventListener('click', () => {
        const name = promptNameInput.value.trim();
        const text = promptInput.value.trim();
        if (text) {
            createPrompt(name || 'Unnamed Prompt', text);
            promptNameInput.value = '';
            promptInput.value = '';
        }
    });

    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            createPromptBtn.click();
        }
    });

    searchHistory.addEventListener('input', renderPrompts);
    sortHistory.addEventListener('change', renderPrompts);

    // Load initial prompts
    async function loadPrompts() {
        try {
            prompts = await storageService.getPrompts();
            renderPrompts();
            populateSimulationDropdown(); // Ensure dropdown is populated on load
        } catch (error) {
            console.error('Error loading prompts:', error);
            alert('Failed to load prompts. Please try again.');
        }
    }

    // Start Simulation Section Logic
    const simulationSelect = document.getElementById('simulationSelect');
    const startSimulationBtn = document.getElementById('startSimulationBtn');

    function populateSimulationDropdown() {
        simulationSelect.innerHTML = '<option value="" disabled selected>Select a Simulation</option>';
        prompts.forEach(prompt => {
            const option = document.createElement('option');
            option.value = prompt.id;
            option.textContent = prompt.name || 'Unnamed Simulation';
            simulationSelect.appendChild(option);
        });
    }

    startSimulationBtn.addEventListener('click', () => {
        const selectedPromptId = simulationSelect.value;
        if (selectedPromptId) {
            const selectedPrompt = prompts.find(prompt => prompt.id === parseInt(selectedPromptId));
            if (selectedPrompt) {
                currentSimulationPrompt = `You are a virtual patient simulator. Pretend you are a real person presenting at a clinic. Do not mention the name of the disease. Instead, describe only the symptoms as a patient would. You will answer the doctor's questions as if you are experiencing the illness — in the first person (e.g., “I've been coughing for 3 days”). Be realistic and consistent with the condition. Answer one question at a time. Wait for the next question before continuing. The case description is: ${selectedPrompt.text}.`.trim();
                openChatWindow(null); // Open chat without initial user message
            } else {
                alert('Error: Selected simulation not found.');
            }
        } else {
            alert('Please select a simulation to start.');
        }
    });

    // Chat Window Functions
    let chatMessages = document.getElementById('chatMessages'); // Initialize here
    let chatStatus = document.getElementById('chatStatus');   // Initialize here
    let chatInput = document.getElementById('chatInput');     // Initialize here
    let sendButton = document.getElementById('sendMessage');   // Initialize here
    const closeButton = document.getElementById('closeChatBtn');

    const handleKeydown = async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const message = chatInput.value.trim();
            if (message) {
                chatInput.value = '';
                await sendMessage(message);
            }
        }
    };

    const handleSendClick = async () => {
        const message = chatInput.value.trim();
        if (message) {
            chatInput.value = '';
            await sendMessage(message);
        }
    };

    window.openChatWindow = async function(initialUserMessage) {
        const chatWindowElement = document.getElementById('chatWindow');
        chatMessages = document.getElementById('chatMessages');
        chatStatus = document.getElementById('chatStatus');
        chatInput = document.getElementById('chatInput');
        sendButton = document.getElementById('sendMessage');

        if (!chatWindowElement || !chatMessages || !chatStatus || !chatInput || !sendButton) {
            console.error('Missing chat window elements');
            return;
        }

        chatMessages.innerHTML = '';
        chatInput.value = '';
        currentConversation = [];
        isProcessing = false;

        chatWindowElement.classList.add('active');

        chatInput.removeEventListener('keydown', handleKeydown);
        sendButton.removeEventListener('click', handleSendClick);

        chatInput.addEventListener('keydown', handleKeydown);
        sendButton.addEventListener('click', handleSendClick);

        chatInput.focus();

        // If a simulation is started, the first message to the AI should be the simulation prompt
        if (currentSimulationPrompt) {
            currentConversation.push({ role: 'system', content: currentSimulationPrompt });
            currentSimulationPrompt = null; // Clear it after sending
            if (initialUserMessage) {
                await sendMessage(initialUserMessage);
            }
        } else if (initialUserMessage) {
            await sendMessage(initialUserMessage);
        }
    };

    async function sendMessage(message) {
        if (isProcessing) {
            console.log('Already processing a message, please wait...');
            return;
        }

        if (!chatMessages || !chatStatus) return; // Ensure elements exist

        const userMessage = document.createElement('div');
        userMessage.className = 'message user';
        userMessage.textContent = message;
        chatMessages.appendChild(userMessage);

        currentConversation.push({ role: 'user', content: message });

        chatStatus.classList.add('active');
        isProcessing = true;

        try {
            const response = await window.callChatGPT(currentConversation);

            if (document.getElementById('chatWindow').classList.contains('active')) {
                chatStatus.classList.remove('active');

                const assistantMessage = document.createElement('div');
                assistantMessage.className = 'message assistant';
                assistantMessage.textContent = response;
                chatMessages.appendChild(assistantMessage);

                currentConversation.push({ role: 'assistant', content: response });

                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        } catch (error) {
            console.error('Error calling ChatGPT:', error);
            if (document.getElementById('chatWindow').classList.contains('active')) {
                chatStatus.classList.remove('active');
                const errorMessage = document.createElement('div');
                errorMessage.className = 'message error';
                errorMessage.textContent = error.message || 'Error generating response. Please try again.';
                chatMessages.appendChild(errorMessage);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        } finally {
            isProcessing = false;
            if (chatStatus) chatStatus.classList.remove('active');
        }
    }

    window.closeChatWindow = function() {
        const chatWindowElement = document.getElementById('chatWindow');
        chatStatusElement = document.getElementById('chatStatus');
        chatInputElement = document.getElementById('chatInput');
        sendButtonElement = document.getElementById('sendMessage');

        if (chatInputElement) chatInputElement.removeEventListener('keydown', handleKeydown);
        if (sendButtonElement) sendButtonElement.removeEventListener('click', handleSendClick);

        if (chatWindowElement) chatWindowElement.classList.remove('active');
        if (chatStatusElement) chatStatusElement.classList.remove('active');
        if (chatInputElement) chatInputElement.value = '';

        currentConversation = [];
        isProcessing = false;

        if (window.currentApiCall) {
            window.currentApiCall.abort();
            window.currentApiCall = null;
        }
        currentSimulationPrompt = null; // Clear any pending simulation prompt
    };

    if (closeButton) {
        closeButton.addEventListener('click', closeChatWindow);
    }

    // This function populates the dropdown with existing cases
    function populateCaseDropdown() {
      const editPromptSelect = document.getElementById('editPromptSelect');

      // Clear any existing options in the dropdown
      editPromptSelect.innerHTML = '<option value="" disabled selected>Select a Simulation</option>';

      // Populate the dropdown with options
      prompts.forEach(prompt => {
        const option = document.createElement('option');
        option.value = prompt.id;
        option.textContent = prompt.name || 'Unnamed Simulation';
        editPromptSelect.appendChild(option);
      });
    }

    // Initial load
    loadPrompts();
});