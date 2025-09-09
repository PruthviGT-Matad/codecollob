import React from 'react';
import { Users, User, Crown } from 'lucide-react';

interface UserData {
  id: string;
  name: string;
  joinedAt?: Date;
}

interface UserListProps {
  users: UserData[];
  currentUserId: string;
}

const UserList: React.FC<UserListProps> = ({ users, currentUserId }) => {
  const getRandomColor = (userId: string): string => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-red-500'
    ];
    
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const formatJoinTime = (joinedAt: any) => {
  const date = joinedAt instanceof Date ? joinedAt : new Date(joinedAt);
  return date.toLocaleString();
   };

  return (
    <div className="bg-gray-900 text-white p-4 border-l border-gray-700 min-w-64">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-200">
          Participants ({users.length})
        </h3>
      </div>

      <div className="space-y-2">
        {users.map((user, index) => (
          <div
            key={user.id}
            className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
              user.id === currentUserId 
                ? 'bg-blue-600 bg-opacity-20 border border-blue-600' 
                : 'hover:bg-gray-800'
            }`}
          >
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${getRandomColor(user.id)}`}>
              {getInitials(user.name)}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {user.name}
                  {user.id === currentUserId && (
                    <span className="text-xs text-gray-400 ml-1">(You)</span>
                  )}
                </span>
                {index === 0 && (
                  <Crown className="w-3 h-3 text-yellow-500" title="Room Creator" />
                )}
              </div>
              <div className="text-xs text-gray-400">
                {formatJoinTime(user.joinedAt)}
              </div>
            </div>

            {/* Status Indicator */}
            <div className="w-2 h-2 bg-green-500 rounded-full" title="Online"></div>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <div className="text-center text-gray-500 mt-8">
          <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No users in room</p>
        </div>
      )}

      {/* Room Info */}
      <div className="mt-6 p-3 bg-gray-800 rounded-lg">
        <h4 className="text-xs font-semibold text-gray-300 mb-2">Room Features</h4>
        <div className="text-xs text-gray-400 space-y-1">
          <p>✨ Real-time collaboration</p>
          <p>📁 Shared file system</p>
          <p>⚡ Code execution</p>
          <p>💬 Live cursors</p>
        </div>
      </div>
    </div>
  );
};

export default UserList;
