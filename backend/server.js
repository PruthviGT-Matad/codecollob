const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// In-memory storage for rooms
const rooms = new Map();
const roomFiles = new Map();

// Room structure: { id, users: [], files: {}, currentFile: null }

// Language execution configurations
const languageConfigs = {
  javascript: {
    command: 'node',
    args: ['-e'],
    timeout: 10000
  },
  python: {
    command: 'python3',
    args: ['-c'],
    timeout: 10000
  },
  java: {
    command: 'java',
    args: [],
    timeout: 15000,
    compile: true,
    compileCommand: 'javac'
  },
  cpp: {
    command: './temp_program',
    args: [],
    timeout: 15000,
    compile: true,
    compileCommand: 'g++',
    compileArgs: ['-o', 'temp_program']
  },
  c: {
    command: './temp_program',
    args: [],
    timeout: 15000,
    compile: true,
    compileCommand: 'gcc',
    compileArgs: ['-o', 'temp_program']
  },
  go: {
    command: 'go',
    args: ['run'],
    timeout: 15000
  },
  rust: {
    command: 'rustc',
    args: ['--edition', '2021', '-o', 'temp_program'],
    timeout: 20000,
    compile: true,
    runCommand: './temp_program'
  }
};
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Create a new room
app.post('/api/rooms/create', (req, res) => {
  const roomId = uuidv4().substring(0, 8);
  
  rooms.set(roomId, {
    id: roomId,
    users: [],
    createdAt: new Date()
  });
  
  roomFiles.set(roomId, {
    '/': {
      name: '/',
      type: 'directory',
      children: {
        'main.js': {
          name: 'main.js',
          content: '// Welcome to the collaborative code editor!\nconsole.log("Hello, World!");',
          type: 'file',
          path: '/main.js'
        },
        'example.py': {
          name: 'example.py',
          content: '# Python example\nprint("Hello from Python!")',
          type: 'file',
          path: '/example.py'
        }
      }
    }
  });
  
  res.json({ roomId, message: 'Room created successfully' });
});

// Join room validation
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  
  if (rooms.has(roomId)) {
    res.json({ exists: true, room: rooms.get(roomId) });
  } else {
    res.status(404).json({ exists: false, message: 'Room not found' });
  }
});

// Get supported languages
app.get('/api/languages', (req, res) => {
  const languages = Object.keys(languageConfigs).map(key => ({
    id: key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    extensions: getLanguageExtensions(key)
  }));
  res.json(languages);
});

function getLanguageExtensions(language) {
  const extensions = {
    javascript: ['.js', '.jsx'],
    python: ['.py'],
    java: ['.java'],
    cpp: ['.cpp', '.cxx', '.cc'],
    c: ['.c'],
    go: ['.go'],
    rust: ['.rs']
  };
  return extensions[language] || [];
}

function getLanguageFromExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  const languageMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.cxx': 'cpp',
    '.cc': 'cpp',
    '.c': 'c',
    '.go': 'go',
    '.rs': 'rust'
  };
  return languageMap[ext] || 'javascript';
}
// Execute code endpoint
app.post('/api/execute', (req, res) => {
  const { code, language, roomId, filename } = req.body;
  
  if (!rooms.has(roomId)) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const detectedLanguage = filename ? getLanguageFromExtension(filename) : language;
  const config = languageConfigs[detectedLanguage];
  
  if (!config) {
    return res.json({ 
      output: `Unsupported language: ${detectedLanguage}. Supported languages: ${Object.keys(languageConfigs).join(', ')}`,
      error: true 
    });
  }
  
  let child;
  let output = '';
  let errorOutput = '';
  
  const timeout = setTimeout(() => {
    if (child) {
      child.kill();
    }
    res.json({ 
      output: output + `\n[Execution timed out after ${config.timeout / 1000} seconds]`,
      error: true 
    });
  }, config.timeout);
  
  try {
    if (config.compile) {
      // Handle compiled languages
      executeCompiledLanguage(detectedLanguage, code, filename, (result) => {
        clearTimeout(timeout);
        
        // Broadcast execution result to room
        io.to(roomId).emit('code-executed', {
          output: result.output,
          exitCode: result.exitCode,
          language: detectedLanguage
        });
        
        res.json(result);
      });
    } else {
      // Handle interpreted languages
      const args = [...config.args];
      if (detectedLanguage === 'go') {
        // For Go, we need to create a temporary file
        const tempFile = `temp_${Date.now()}.go`;
        fs.writeFileSync(tempFile, code);
        child = spawn(config.command, [config.args[0], tempFile]);
      } else {
        args.push(code);
        child = spawn(config.command, args);
      }
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        const finalOutput = output + (errorOutput ? `\nError: ${errorOutput}` : '');
        
        // Broadcast execution result to room
        io.to(roomId).emit('code-executed', {
          output: finalOutput,
          exitCode: code,
          language: detectedLanguage
        });
        
        res.json({ 
          output: finalOutput, 
          exitCode: code,
          error: code !== 0,
          language: detectedLanguage
        });
      });
    }
  } catch (error) {
    clearTimeout(timeout);
    res.json({ 
      output: `Execution error: ${error.message}`,
      error: true,
      language: detectedLanguage
    });
  }
});

function executeCompiledLanguage(language, code, filename, callback) {
  const config = languageConfigs[language];
  const tempDir = '/tmp';
  const timestamp = Date.now();
  
  let sourceFile, executableFile;
  
  switch (language) {
    case 'java':
      sourceFile = path.join(tempDir, `TempClass${timestamp}.java`);
      // Extract class name from code or use default
      const classMatch = code.match(/public\s+class\s+(\w+)/);
      const className = classMatch ? classMatch[1] : `TempClass${timestamp}`;
      const javaCode = code.replace(/public\s+class\s+\w+/, `public class ${className}`);
      fs.writeFileSync(sourceFile, javaCode);
      break;
    case 'cpp':
    case 'c':
      const ext = language === 'cpp' ? '.cpp' : '.c';
      sourceFile = path.join(tempDir, `temp${timestamp}${ext}`);
      executableFile = path.join(tempDir, `temp${timestamp}`);
      fs.writeFileSync(sourceFile, code);
      break;
    case 'rust':
      sourceFile = path.join(tempDir, `temp${timestamp}.rs`);
      executableFile = path.join(tempDir, `temp${timestamp}`);
      fs.writeFileSync(sourceFile, code);
      break;
  }
  
  // Compile
  let compileArgs = [];
  if (language === 'java') {
    compileArgs = [sourceFile];
  } else if (language === 'cpp' || language === 'c') {
    compileArgs = [sourceFile, '-o', executableFile];
  } else if (language === 'rust') {
    compileArgs = [sourceFile, '-o', executableFile];
  }
  
  const compileProcess = spawn(config.compileCommand, compileArgs);
  let compileOutput = '';
  let compileError = '';
  
  compileProcess.stdout.on('data', (data) => {
    compileOutput += data.toString();
  });
  
  compileProcess.stderr.on('data', (data) => {
    compileError += data.toString();
  });
  
  compileProcess.on('close', (code) => {
    if (code !== 0) {
      // Compilation failed
      callback({
        output: `Compilation failed:\n${compileError}`,
        exitCode: code,
        error: true
      });
      return;
    }
    
    // Run the compiled program
    let runCommand, runArgs = [];
    
    if (language === 'java') {
      const classMatch = fs.readFileSync(sourceFile, 'utf8').match(/public\s+class\s+(\w+)/);
      const className = classMatch ? classMatch[1] : `TempClass${timestamp}`;
      runCommand = 'java';
      runArgs = ['-cp', tempDir, className];
    } else {
      runCommand = executableFile;
    }
    
    const runProcess = spawn(runCommand, runArgs);
    let runOutput = '';
    let runError = '';
    
    runProcess.stdout.on('data', (data) => {
      runOutput += data.toString();
    });
    
    runProcess.stderr.on('data', (data) => {
      runError += data.toString();
    });
    
    runProcess.on('close', (code) => {
      // Clean up temporary files
      try {
        if (fs.existsSync(sourceFile)) fs.unlinkSync(sourceFile);
        if (executableFile && fs.existsSync(executableFile)) fs.unlinkSync(executableFile);
        if (language === 'java') {
          const classFile = sourceFile.replace('.java', '.class');
          if (fs.existsSync(classFile)) fs.unlinkSync(classFile);
        }
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
      
      const finalOutput = runOutput + (runError ? `\nError: ${runError}` : '');
      callback({
        output: finalOutput,
        exitCode: code,
        error: code !== 0
      });
    });
  });
}

// Helper function to get file from path
function getFileFromPath(files, filePath) {
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
}

// Helper function to set file at path
function setFileAtPath(files, filePath, fileData) {
  const parts = filePath.split('/').filter(part => part !== '');
  const fileName = parts.pop();
  
  let current = files['/'];
  
  // Navigate to parent directory
  for (const part of parts) {
    if (!current.children[part]) {
      current.children[part] = {
        name: part,
        type: 'directory',
        children: {}
      };
    }
    current = current.children[part];
  }
  
  // Set the file
  current.children[fileName] = fileData;
}

// Helper function to delete file at path
function deleteFileAtPath(files, filePath) {
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
  if (current.children && current.children[fileName]) {
    delete current.children[fileName];
    return true;
  }
  
  return false;
}
// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join room
  socket.on('join-room', ({ roomId, userName }) => {
    if (!rooms.has(roomId)) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;
    
    const room = rooms.get(roomId);
    room.users.push({ id: socket.id, name: userName, joinedAt: new Date() });
    
    // Send current files to the newly joined user
    const files = roomFiles.get(roomId) || {};
    socket.emit('files-sync', files);
    
    // Notify other users
    socket.to(roomId).emit('user-joined', { 
      user: { id: socket.id, name: userName },
      users: room.users
    });
    
    // Send current users list to the joined user
    socket.emit('users-list', room.users);
    
    console.log(`${userName} joined room ${roomId}`);
  });
  
  // Handle code changes
  socket.on('code-change', ({ filePath, content, roomId }) => {
    if (!roomFiles.has(roomId)) {
      roomFiles.set(roomId, {});
    }
    
    const files = roomFiles.get(roomId);
    const file = getFileFromPath(files, filePath);
    if (file && file.type === 'file') {
      file.content = content;
      
      // Broadcast to other users in the room
      socket.to(roomId).emit('code-update', { filePath, content });
    }
  });
  
  // Handle cursor position changes
  socket.on('cursor-change', ({ position, roomId }) => {
    socket.to(roomId).emit('cursor-update', { 
      userId: socket.id, 
      userName: socket.userName,
      position 
    });
  });
  
  // File operations
  socket.on('create-file', ({ filePath, content = '', type = 'file', roomId }) => {
    if (!roomFiles.has(roomId)) {
      roomFiles.set(roomId, {});
    }
    
    const files = roomFiles.get(roomId);
    const fileName = filePath.split('/').pop();
    
    const fileData = {
      name: fileName,
      path: filePath,
      type: type,
      content: content,
      createdAt: new Date()
    };
    
    if (type === 'directory') {
      fileData.children = {};
      delete fileData.content;
    }
    
    setFileAtPath(files, filePath, fileData);
    
    // Broadcast to all users in room
    io.to(roomId).emit('file-created', { filePath, file: fileData });
  });
  
  socket.on('delete-file', ({ filePath, roomId }) => {
    if (roomFiles.has(roomId)) {
      const files = roomFiles.get(roomId);
      deleteFileAtPath(files, filePath);
      
      // Broadcast to all users in room
      io.to(roomId).emit('file-deleted', { filePath });
    }
  });
  
  socket.on('rename-file', ({ oldPath, newPath, roomId }) => {
    if (roomFiles.has(roomId)) {
      const files = roomFiles.get(roomId);
      const file = getFileFromPath(files, oldPath);
      if (file) {
        const newName = newPath.split('/').pop();
        const newFile = { ...file, name: newName, path: newPath };
        
        deleteFileAtPath(files, oldPath);
        setFileAtPath(files, newPath, newFile);
        
        // Broadcast to all users in room
        io.to(roomId).emit('file-renamed', { oldPath, newPath });
      }
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      room.users = room.users.filter(user => user.id !== socket.id);
      
      // Notify other users
      socket.to(socket.roomId).emit('user-left', { 
        userId: socket.id,
        users: room.users
      });
      
      // Clean up empty rooms
      if (room.users.length === 0) {
        rooms.delete(socket.roomId);
        roomFiles.delete(socket.roomId);
        console.log(`Room ${socket.roomId} deleted (empty)`);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready for connections`);
});