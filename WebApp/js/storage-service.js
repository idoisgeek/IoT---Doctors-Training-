class StorageService {
    constructor(storageType = 'file') {
        this.storageType = storageType; // 'file' or 'online'
        this.API_URL = 'http://localhost:3000/api/prompts'; // Local server endpoint
    }

    // Save prompts
    async savePrompts(prompts) {
        if (this.storageType === 'file' || this.storageType === 'online') {
            return this._saveOnline(prompts);
        }
        throw new Error('Invalid storage type');
    }

    // Get prompts
    async getPrompts() {
        if (this.storageType === 'file' || this.storageType === 'online') {
            return this._getOnline();
        }
        throw new Error('Invalid storage type');
    }

    // Delete prompt
    async deletePrompt(id) {
        if (this.storageType === 'file' || this.storageType === 'online') {
            return this._deleteOnline(id);
        }
        throw new Error('Invalid storage type');
    }



    // Online Storage Methods
    async _saveOnline(prompts) {
        try {
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(prompts)
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error saving online:', error);
            throw error;
        }
    }

    async _getOnline() {
        try {
            const response = await fetch(this.API_URL);
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching online:', error);
            throw error;
        }
    }

    async _deleteOnline(id) {
        try {
            const response = await fetch(`${this.API_URL}/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error deleting online:', error);
            throw error;
        }
    }

    // Switch storage type
    setStorageType(type) {
        if (!['file', 'online'].includes(type)) {
            throw new Error('Invalid storage type. Use "file" or "online"');
        }
        this.storageType = type;
    }


}
