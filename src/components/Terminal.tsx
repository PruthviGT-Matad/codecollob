import React, { useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Play, Loader, Code } from 'lucide-react';

interface TerminalProps {
  output: string[];
  isExecuting: boolean;
  onExecute: (code: string, language: string, filename?: string) => void;
  currentFile: string | null;
  files: { [key: string]: any };
}

const Terminal: React.FC<TerminalProps> = ({
  output,
  isExecuting,
  onExecute,
  currentFile,
  files
}) => {
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleExecute = () => {
    if (!currentFile) {
      return;
    }

    // Find the file in the nested structure
    const file = findFileByPath(files, currentFile);
    if (!file || file.type !== 'file') {
      return;
    }

    const extension = currentFile.split('.').pop()?.toLowerCase();
    
    let language = 'javascript';
    switch (extension) {
      case 'py':
        language = 'python';
        break;
      case 'java':
        language = 'java';
        break;
      case 'cpp':
      case 'cxx':
      case 'cc':
        language = 'cpp';
        break;
      case 'c':
        language = 'c';
        break;
      case 'go':
        language = 'go';
        break;
      case 'rs':
        language = 'rust';
        break;
      default:
        language = 'javascript';
    }
      language = 'python';
    }

    onExecute(file.content, language, currentFile);
  };

  const findFileByPath = (files: any, path: string): any => {
    const parts = path.split('/').filter(part => part !== '');
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

  const getLanguageFromFile = (fileName: string): string => {
    const extension = fileName?.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'py':
        return 'Python';
      case 'java':
        return 'Java';
      case 'cpp':
      case 'cxx':
      case 'cc':
        return 'C++';
      case 'c':
        return 'C';
      case 'go':
        return 'Go';
      case 'rs':
        return 'Rust';
      case 'js':
      case 'jsx':
        return 'JavaScript';
      case 'ts':
      case 'tsx':
        return 'TypeScript';
      default:
        return 'Text';
    }
  };

  return (
    <div className="h-full bg-black text-green-400 font-mono flex flex-col">
      {/* Terminal Header */}
      <div className="flex items-center justify-between p-3 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4" />
          <span className="text-sm font-semibold">Terminal</span>
        </div>
        
        <div className="flex items-center gap-2">
          {currentFile && (
            <div className="flex items-center gap-1">
              <Code className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400">
                {getLanguageFromFile(currentFile)}
              </span>
            </div>
          )}
          <button
            onClick={handleExecute}
            disabled={!currentFile || isExecuting}
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
              !currentFile || isExecuting
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isExecuting ? (
              <>
                <Loader className="w-3 h-3 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Run
              </>
            )}
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div 
        ref={outputRef}
        className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed"
      >
        {output.length === 0 ? (
          <div className="text-gray-500">
            <p>Terminal ready. Select a file and click "Run" to execute code.</p>
            <p className="mt-2 text-xs">
              Supported languages: JavaScript (.js), Python (.py), Java (.java), 
              C++ (.cpp), C (.c), Go (.go), Rust (.rs)
            </p>
          </div>
        ) : (
          output.map((line, index) => (
            <div key={index} className="mb-1">
              {line.startsWith('Error:') || line.includes('error') || line.includes('Error') || line.includes('Compilation failed') ? (
                <span className="text-red-400">{line}</span>
              ) : line.includes('Warning') || line.includes('warning') ? (
                <span className="text-yellow-400">{line}</span>
              ) : line.includes('Compilation successful') || line.includes('Build successful') ? (
                <span className="text-green-400">{line}</span>
              ) : (
                <span>{line}</span>
              )}
            </div>
          ))
        )}
        
        {isExecuting && (
          <div className="text-blue-400 flex items-center gap-2 mt-2">
            <Loader className="w-3 h-3 animate-spin" />
            Executing code...
          </div>
        )}
        
        {/* Cursor */}
        <span className="animate-pulse">█</span>
      </div>
    </div>
  );
};

export default Terminal;