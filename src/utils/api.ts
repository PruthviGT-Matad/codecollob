const API_BASE_URL = 'http://localhost:3001/api';

export const api = {
  // Room operations
  createRoom: async () => {
    const response = await fetch(`${API_BASE_URL}/rooms/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  },

  checkRoom: async (roomId: string) => {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}`);
    return response.json();
  },

  // Code execution
  executeCode: async (code: string, language: string, roomId: string, filename?: string) => {
    const response = await fetch(`${API_BASE_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language, roomId, filename })
    });
    return response.json();
  },

  // Get supported languages
  getSupportedLanguages: async () => {
    const response = await fetch(`${API_BASE_URL}/languages`);
    return response.json();
  },

  // Health check
  healthCheck: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.json();
    } catch (error) {
      throw new Error('Server is not responding');
    }
  }
};