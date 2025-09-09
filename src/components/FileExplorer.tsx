import React, { useState } from 'react';
import { 
  File, 
  Folder, 
  FolderOpen,
  Plus, 
  MoreHorizontal, 
  Trash2, 
  Edit, 
  FileText,
  ChevronRight,
  ChevronDown,
  FolderPlus
} from 'lucide-react';

interface FileItem {
  name: string;
  path: string;
  content?: string;
  type: 'file' | 'directory';
  children?: { [key: string]: FileItem };
  createdAt?: Date;
}

interface FileExplorerProps {
  files: { [key: string]: FileItem };
  currentFile: string | null;
  onFileSelect: (filePath: string) => void;
  onFileCreate: (filePath: string, type: 'file' | 'directory') => void;
  onFileDelete: (filePath: string) => void;
  onFileRename: (oldPath: string, newPath: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  currentFile,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename
}) => {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['/']));
  const [showCreateInput, setShowCreateInput] = useState<string | null>(null);
  const [createType, setCreateType] = useState<'file' | 'directory'>('file');
  const [newItemName, setNewItemName] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [showMenu, setShowMenu] = useState<string | null>(null);

  const toggleDirectory = (dirPath: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(dirPath)) {
      newExpanded.delete(dirPath);
    } else {
      newExpanded.add(dirPath);
    }
    setExpandedDirs(newExpanded);
  };

  const handleCreateItem = (parentPath: string) => {
    if (newItemName.trim()) {
      const newPath = parentPath === '/' ? `/${newItemName.trim()}` : `${parentPath}/${newItemName.trim()}`;
      onFileCreate(newPath, createType);
      setNewItemName('');
      setShowCreateInput(null);
      
      // Expand parent directory if creating inside it
      if (parentPath !== '/') {
        setExpandedDirs(prev => new Set([...prev, parentPath]));
      }
    }
  };

  const handleRenameItem = (oldPath: string) => {
    if (editItemName.trim() && editItemName !== oldPath.split('/').pop()) {
      const pathParts = oldPath.split('/');
      pathParts.pop();
      const parentPath = pathParts.join('/') || '/';
      const newPath = parentPath === '/' ? `/${editItemName.trim()}` : `${parentPath}/${editItemName.trim()}`;
      onFileRename(oldPath, newPath);
    }
    setEditingItem(null);
    setEditItemName('');
  };

  const startRename = (filePath: string) => {
    setEditingItem(filePath);
    setEditItemName(filePath.split('/').pop() || '');
    setShowMenu(null);
  };

  const startCreate = (parentPath: string, type: 'file' | 'directory') => {
    setShowCreateInput(parentPath);
    setCreateType(type);
    setNewItemName('');
  };

  const getFileIcon = (fileName: string, type: 'file' | 'directory') => {
    if (type === 'directory') {
      return <Folder className="w-4 h-4 text-blue-400" />;
    }

    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'js':
      case 'jsx':
        return <FileText className="w-4 h-4 text-yellow-400" />;
      case 'ts':
      case 'tsx':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'py':
        return <FileText className="w-4 h-4 text-green-400" />;
      case 'java':
        return <FileText className="w-4 h-4 text-red-400" />;
      case 'cpp':
      case 'cxx':
      case 'cc':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'c':
        return <FileText className="w-4 h-4 text-gray-400" />;
      case 'go':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      case 'rs':
        return <FileText className="w-4 h-4 text-orange-600" />;
      case 'html':
        return <FileText className="w-4 h-4 text-orange-400" />;
      case 'css':
        return <FileText className="w-4 h-4 text-blue-300" />;
      case 'json':
        return <FileText className="w-4 h-4 text-green-400" />;
      default:
        return <File className="w-4 h-4 text-gray-400" />;
    }
  };

  const renderFileTree = (item: FileItem, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedDirs.has(item.path);
    const isEditing = editingItem === item.path;
    const isSelected = currentFile === item.path;

    return (
      <div key={item.path}>
        <div
          className={`flex items-center justify-between py-1 px-2 rounded cursor-pointer transition-colors group ${
            isSelected && item.type === 'file'
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-700'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (item.type === 'directory') {
              toggleDirectory(item.path);
            } else {
              onFileSelect(item.path);
            }
          }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {item.type === 'directory' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDirectory(item.path);
                }}
                className="p-0.5 hover:bg-gray-600 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
            )}
            
            {getFileIcon(item.name, item.type)}
            
            {isEditing ? (
              <input
                type="text"
                value={editItemName}
                onChange={(e) => setEditItemName(e.target.value)}
                className="flex-1 px-1 text-xs bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleRenameItem(item.path);
                  if (e.key === 'Escape') {
                    setEditingItem(null);
                    setEditItemName('');
                  }
                }}
                onBlur={() => handleRenameItem(item.path)}
                autoFocus
              />
            ) : (
              <span className="text-sm truncate">{item.name}</span>
            )}
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {item.type === 'directory' && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startCreate(item.path, 'file');
                  }}
                  className="p-1 hover:bg-gray-600 rounded"
                  title="New file"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startCreate(item.path, 'directory');
                  }}
                  className="p-1 hover:bg-gray-600 rounded"
                  title="New folder"
                >
                  <FolderPlus className="w-3 h-3" />
                </button>
              </>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(showMenu === item.path ? null : item.path);
              }}
              className="p-1 hover:bg-gray-600 rounded"
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>
          </div>
        </div>

        {showMenu === item.path && (
          <div 
            className="absolute right-4 bg-gray-800 border border-gray-600 rounded shadow-lg py-1 z-10 min-w-32"
            style={{ marginTop: '-24px' }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                startRename(item.path);
              }}
              className="w-full px-3 py-1 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
            >
              <Edit className="w-3 h-3" />
              Rename
            </button>
            {item.path !== '/' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
                    onFileDelete(item.path);
                  }
                  setShowMenu(null);
                }}
                className="w-full px-3 py-1 text-left text-sm hover:bg-gray-700 text-red-400 flex items-center gap-2"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            )}
          </div>
        )}

        {showCreateInput === item.path && (
          <div 
            className="py-1 px-2"
            style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
          >
            <div className="flex items-center gap-2 mb-2">
              {createType === 'directory' ? (
                <Folder className="w-4 h-4 text-blue-400" />
              ) : (
                <File className="w-4 h-4 text-gray-400" />
              )}
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={`Enter ${createType} name...`}
                className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleCreateItem(item.path);
                  if (e.key === 'Escape') {
                    setShowCreateInput(null);
                    setNewItemName('');
                  }
                }}
                onBlur={() => {
                  if (!newItemName.trim()) {
                    setShowCreateInput(null);
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => handleCreateItem(item.path)}
                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateInput(null);
                  setNewItemName('');
                }}
                className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {item.type === 'directory' && isExpanded && item.children && (
          <div>
            {Object.values(item.children)
              .sort((a, b) => {
                // Directories first, then files
                if (a.type !== b.type) {
                  return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
              })
              .map(child => renderFileTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootDir = files['/'];

  return (
    <div className="h-full bg-gray-900 text-white p-4 border-r border-gray-700 relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-200">Explorer</h3>
        <div className="flex gap-1">
          <button
            onClick={() => startCreate('/', 'file')}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="New file"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => startCreate('/', 'directory')}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="New folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {rootDir && rootDir.children && Object.values(rootDir.children).length > 0 ? (
          Object.values(rootDir.children)
            .sort((a, b) => {
              // Directories first, then files
              if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            })
            .map(item => renderFileTree(item, 0))
        ) : (
          <div className="text-center text-gray-500 mt-8">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No files yet</p>
            <p className="text-xs">Click + to create one</p>
          </div>
        )}
      </div>

      {showCreateInput === '/' && (
        <div className="mt-3 p-2 bg-gray-800 rounded">
          <div className="flex items-center gap-2 mb-2">
            {createType === 'directory' ? (
              <Folder className="w-4 h-4 text-blue-400" />
            ) : (
              <File className="w-4 h-4 text-gray-400" />
            )}
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={`Enter ${createType} name...`}
              className="flex-1 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleCreateItem('/');
                if (e.key === 'Escape') {
                  setShowCreateInput(null);
                  setNewItemName('');
                }
              }}
              onBlur={() => {
                if (!newItemName.trim()) {
                  setShowCreateInput(null);
                }
              }}
              autoFocus
            />
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => handleCreateItem('/')}
              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowCreateInput(null);
                setNewItemName('');
              }}
              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;