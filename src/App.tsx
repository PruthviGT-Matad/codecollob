import React, { useState, useEffect, useCallback } from 'react';
import CodeEditor from './components/CodeEditor';
import FileExplorer from './components/FileExplorer';
import Terminal from './components/Terminal';
import UserList from './components/UserList';
import RoomManager from './components/RoomManager';
import useSocket from './hooks/useSocket';
import { api } from './utils/api';

interface FileItem {
  name: string;
  path: string;
  content: string;
  type: 'file' | 'directory';
  children?: { [key: string]: FileItem };
  createdAt?: Date;
}

interface User {
  id: string;
  name: string;
  joinedAt?: Date;
}

function App() {
  // Room state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [isInRoom, setIsInRoom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // File system state
  const [files, setFiles] = useState<{ [key: string]: FileItem }>({});
  const [currentFile, setCurrentFile] = useState<string | null>(null);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Terminal state
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  // Socket connection
  const { socket, isConnected, error } = useSocket();

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Store socket ID
    socket.on('connect', () => {
      setCurrentUserId(socket.id);
    });

    // File synchronization
    socket.on('files-sync', (syncedFiles: { [key: string]: FileItem }) => {
      setFiles(syncedFiles);
      // Find first file in the directory structure
      const firstFile = findFirstFile(syncedFiles);
      if (firstFile && !currentFile) {
        setCurrentFile(firstFile);
      }
    });

    // Real-time code updates
    socket.on('code-update', ({ filePath, content }) => {
      setFiles(prev => {
        const newFiles = { ...prev };
        const file = getFileFromPath(newFiles, filePath);
        if (file && file.type === 'file') {
          file.content = content;
        }
        return newFiles;
      });
    });

    // File operations
    socket.on('file-created', ({ filePath, file }) => {
      setFiles(prev => {
        const newFiles = { ...prev };
        setFileAtPath(newFiles, filePath, file);
        return newFiles;
      });
    });

    socket.on('file-deleted', ({ filePath }) => {
      setFiles(prev => {
        const newFiles = { ...prev };
        deleteFileAtPath(newFiles, filePath);
        if (currentFile === filePath) {
          const firstFile = findFirstFile(newFiles);
          setCurrentFile(firstFile);
        }
        return newFiles;
      });
    });

    socket.on('file-renamed', ({ oldPath, newPath }) => {
      setFiles(prev => {
        const newFiles = { ...prev };
        const file = getFileFromPath(newFiles, oldPath);
        if (file) {
          const newName = newPath.split('/').pop() || '';
          const updatedFile = { ...file, name: newName, path: newPath };
          deleteFileAtPath(newFiles, oldPath);
          setFileAtPath(newFiles, newPath, updatedFile);
        }
        return newFiles;
      });
      
      if (currentFile === oldPath) {
        setCurrentFile(newPath);
      }
    });

    // User management
    socket.on('users-list', (usersList: User[]) => {
      setUsers(usersList);
    });

    socket.on('user-joined', ({ user, users: updatedUsers }) => {
      setUsers(updatedUsers);
      setTerminalOutput(prev => [...prev, `👋 ${user.name} joined the room`]);
    });

    socket.on('user-left', ({ userId, users: updatedUsers }) => {
      const leftUser = users.find(u => u.id === userId);
      setUsers(updatedUsers);
      if (leftUser) {
        setTerminalOutput(prev => [...prev, `👋 ${leftUser.name} left the room`]);
      }
    });

    // Code execution
    socket.on('code-executed', ({ output }) => {
      setTerminalOutput(prev => [...prev, '> Code executed by another user:', output]);
      setIsExecuting(false);
    });

    // Error handling
    socket.on('error', ({ message }) => {
      console.error('Socket error:', message);
      setTerminalOutput(prev => [...prev, `❌ Error: ${message}`]);
    });

    return () => {
      socket.off('connect');
      socket.off('files-sync');
      socket.off('code-update');
      socket.off('file-created');
      socket.off('file-deleted');
      socket.off('file-renamed');
      socket.off('users-list');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('code-executed');
      socket.off('error');
    };
  }, [socket, currentFile, users]);

  // Helper functions for file system operations
  const findFirstFile = (files: { [key: string]: FileItem }): string | null => {
    const rootDir = files['/'];
    if (!rootDir || !rootDir.children) return null;
    
    const findFile = (children: { [key: string]: FileItem }): string | null => {
      for (const child of Object.values(children)) {
        if (child.type === 'file') {
          return child.path;
        } else if (child.type === 'directory' && child.children) {
          const found = findFile(child.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findFile(rootDir.children);
  };

  const getFileFromPath = (files: { [key: string]: FileItem }, filePath: string): FileItem | null => {
    const parts = filePath.split('/').filter(part => part !== '');
    let current = files['/'];
    
    for (const part of parts) {
      if (current && current.children && current.children[part]) {
        current = current.children[part];
      } else {
        return null;
      }
    }
    
    return current;
  };

  const setFileAtPath = (files: { [key: string]: FileItem }, filePath: string, fileData: FileItem) => {
    const parts = filePath.split('/').filter(part => part !== '');
    const fileName = parts.pop();
    
    let current = files['/'];
    
    // Navigate to parent directory
    for (const part of parts) {
      if (!current.children) current.children = {};
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: current.path === '/' ? `/${part}` : `${current.path}/${part}`,
          type: 'directory',
          children: {}
        };
      }
      current = current.children[part];
    }
    
    // Set the file
    if (fileName && current.children) {
      current.children[fileName] = fileData;
    }
  };

  const deleteFileAtPath = (files: { [key: string]: FileItem }, filePath: string) => {
    const parts = filePath.split('/').filter(part => part !== '');
    const fileName = parts.pop();
    
    let current = files['/'];
    
    // Navigate to parent directory
    for (const part of parts) {
      if (current.children && current.children[part]) {
        current = current.children[part];
      } else {
        return false;
      }
    }
    
    // Delete the file
    if (fileName && current.children && current.children[fileName]) {
      delete current.children[fileName];
      return true;
    }
    
    return false;
  };

  // Room management functions
  const createRoom = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.createRoom();
      // Room creation handled in RoomManager component
    } catch (error) {
      console.error('Failed to create room:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const joinRoom = useCallback(async (roomId: string, userName: string) => {
    if (!socket) return;
    
    setIsLoading(true);
    try {
      // Validate room exists
      const roomCheck = await api.checkRoom(roomId);
      
      if (!roomCheck.exists) {
        setTerminalOutput(prev => [...prev, `❌ Room ${roomId} not found`]);
        return;
      }

      // Join the room via socket
      socket.emit('join-room', { roomId, userName });
      
      setRoomId(roomId);
      setUserName(userName);
      setIsInRoom(true);
      setTerminalOutput([`🚀 Welcome to room ${roomId}!`, `📝 You can start coding now...`]);
      
    } catch (error) {
      console.error('Failed to join room:', error);
      setTerminalOutput(prev => [...prev, `❌ Failed to join room: ${error}`]);
    } finally {
      setIsLoading(false);
    }
  }, [socket]);

  // File operations
  const handleFileSelect = useCallback((filePath: string) => {
    setCurrentFile(filePath);
  }, []);

  const handleFileCreate = useCallback((filePath: string, type: 'file' | 'directory' = 'file') => {
    if (!socket || !roomId) return;
    
    let content = '';
    if (type === 'file') {
      const extension = filePath.split('.').pop()?.toLowerCase();
      switch (extension) {
        case 'py':
          content = `# New Python file\nprint("Hello, World!")`;
          break;
        case 'java':
          const className = filePath.split('/').pop()?.replace('.java', '') || 'Main';
          content = `public class ${className} {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`;
          break;
        case 'cpp':
        case 'cxx':
        case 'cc':
          content = `#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}`;
          break;
        case 'c':
          content = `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}`;
          break;
        case 'go':
          content = `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}`;
          break;
        case 'rs':
          content = `fn main() {\n    println!("Hello, World!");\n}`;
          break;
        default:
          content = `// New file: ${filePath.split('/').pop()}\nconsole.log("Hello, World!");`;
      }
    }
    
    socket.emit('create-file', { 
      filePath, 
      content,
      type,
      roomId 
    });
  }, [socket, roomId]);

  const handleFileDelete = useCallback((filePath: string) => {
    if (!socket || !roomId) return;
    
    socket.emit('delete-file', { filePath, roomId });
  }, [socket, roomId]);

  const handleFileRename = useCallback((oldPath: string, newPath: string) => {
    if (!socket || !roomId) return;
    
    socket.emit('rename-file', { oldPath, newPath, roomId });
  }, [socket, roomId]);

  // Code editing
  const handleCodeChange = useCallback((content: string) => {
    if (!currentFile || !socket || !roomId) return;
    
    setFiles(prev => {
      const newFiles = { ...prev };
      const file = getFileFromPath(newFiles, currentFile);
      if (file && file.type === 'file') {
        file.content = content;
      }
      return newFiles;
    });
    
    socket.emit('code-change', { filePath: currentFile, content, roomId });
  }, [currentFile, socket, roomId]);

  const handleCursorChange = useCallback((position: any) => {
    if (!socket || !roomId) return;
    
    socket.emit('cursor-change', { position, roomId });
  }, [socket, roomId]);

  // Code execution
  const handleCodeExecute = useCallback(async (code: string, language: string, filename?: string) => {
    if (!roomId) return;
    
    setIsExecuting(true);
    setTerminalOutput(prev => [...prev, `> Executing ${language} code...`]);
    
    try {
      const result = await api.executeCode(code, language, roomId, filename);
      setTerminalOutput(prev => [...prev, result.output]);
    } catch (error) {
      setTerminalOutput(prev => [...prev, `❌ Execution failed: ${error}`]);
    } finally {
      setIsExecuting(false);
    }
  }, [roomId]);

  // Show connection error
  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <h2 className="text-xl font-semibold mb-2">Connection Error</h2>
            <p>{error}</p>
          </div>
          <p className="text-gray-600">Make sure the backend server is running on port 3001</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Show room manager if not in room
  if (!isInRoom) {
    return (
      <RoomManager
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        isLoading={isLoading}
      />
    );
  }

  // Main application interface
  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-800">CodeCollab</h1>
            <div className="text-sm text-gray-500">
              Room: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{roomId}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer */}
        <div className="w-64 border-r border-gray-300">
          <FileExplorer
            files={files}
            currentFile={currentFile}
            onFileSelect={handleFileSelect}
            onFileCreate={handleFileCreate}
            onFileDelete={handleFileDelete}
            onFileRename={handleFileRename}
          />
        </div>

        {/* Code Editor */}
        <div className="flex-1 flex flex-col">
          {currentFile ? (
            <>
              <div className="bg-gray-200 px-4 py-2 border-b border-gray-300 flex items-center gap-2">
                <span className="text-sm font-medium">{currentFile.split('/').pop()}</span>
                <span className="text-xs text-gray-500">{currentFile}</span>
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
              <div className="flex-1">
                <CodeEditor
                  fileName={currentFile.split('/').pop() || ''}
                  content={getFileFromPath(files, currentFile)?.content || ''}
                  language="javascript"
                  onChange={handleCodeChange}
                  onCursorChange={handleCursorChange}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2">No file selected</p>
                <p className="text-sm">Create a file or select one from the explorer</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="w-80 flex flex-col border-l border-gray-300">
          {/* Terminal */}
          <div className="flex-1 border-b border-gray-300">
            <Terminal
              output={terminalOutput}
              isExecuting={isExecuting}
              onExecute={handleCodeExecute}
              currentFile={currentFile}
              files={files}
            />
          </div>

          {/* User List */}
          <div className="h-64">
            <UserList users={users} currentUserId={currentUserId} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;