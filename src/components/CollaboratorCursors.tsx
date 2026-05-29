import React from 'react';
import { useMultiplayer } from '../context/MultiplayerContext';

export const CollaboratorCursors: React.FC = () => {
  const { collaborators } = useMultiplayer();

  return (
    <>
      {Object.values(collaborators).map(peer => {
        // SVG Mouse pointer path matching standard cursor directions
        const cursorColor = peer.color;

        return (
          <div
            key={peer.id}
            style={{
              position: 'absolute',
              left: `${peer.x}px`,
              top: `${peer.y}px`,
              pointerEvents: 'none',
              zIndex: 9999,
              transition: 'transform 0.05s linear', // slight transition buffer for sub-frame smoothness
            }}
          >
            {/* SVG Pointer Cursor */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]"
            >
              <path
                d="M4 3V20.14L9.13 14.88L16.21 21.94L19.5 18.66L12.51 11.5L18 11.5L4 3Z"
                fill={cursorColor}
                stroke="#090a0f"
                strokeWidth="1.5"
                strokeLinejoin="miter"
              />
            </svg>

            {/* Glowing Custom Name Badge */}
            <div
              style={{
                backgroundColor: 'rgba(9, 10, 15, 0.9)',
                border: `1px solid ${cursorColor}`,
                boxShadow: `0 0 10px ${cursorColor}40`,
              }}
              className="ml-4 mt-2 px-2.5 py-1 rounded-md flex items-center gap-1.5 backdrop-blur-md"
            >
              {/* Status Glowing Dot */}
              <span
                style={{
                  backgroundColor:
                    peer.status === 'busy'
                      ? '#f59e0b' // yellow
                      : peer.status === 'syncing'
                      ? '#10b981' // green
                      : '#6b7280' // slate
                }}
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  peer.status !== 'idle' ? 'animate-pulse' : ''
                }`}
              />
              
              {/* Peer Username */}
              <span className="text-[9px] font-bold font-mono text-slate-100 whitespace-nowrap leading-none">
                {peer.name}
              </span>

              {/* Action Overlay */}
              {peer.status !== 'idle' && (
                <span className="text-[7px] font-mono text-slate-400 border-l border-slate-700 pl-1.5 leading-none uppercase">
                  {peer.status}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};
