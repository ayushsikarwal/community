import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

const getInitials = (name) => {
  if (!name || typeof name !== "string") return "?";
  return (
    name
      .trim()
      .split(/\s+/)
      .map((word) => word[0] || "")
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
};

const getRandomColor = () => {
  const colors = [
    "#4F46E5",
    "#059669",
    "#B45309",
    "#7C3AED",
    "#BE185D",
    "#1D4ED8",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

const App = () => {
  const [username, setUsername] = useState("");
  const [userColor, setUserColor] = useState("");
  const [joined, setJoined] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [isTyping, setIsTyping] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    socket.on("receive-message", (data) => {
      setMessages((prev) => [
        ...prev,
        {
          ...data,
          timestamp: new Date(),
          username: data.username || "Anonymous",
        },
      ]);
      scrollToBottom();
    });

    socket.on("user-joined", (userData) => {
      setUsers((prev) => {
        const isUserPresent = prev.some(
          (u) => u.username === userData.username
        );
        if (!isUserPresent) {
          return [
            ...prev,
            {
              ...userData,
              color: getRandomColor(),
            },
          ];
        }
        return prev;
      });
    });

    socket.on("user-left", (userData) => {
      setUsers((prev) => prev.filter((u) => u.username !== userData.username));
    });

    socket.on("existing-users", (userList) => {
      setUsers(
        userList.map((userData) => ({
          ...userData,
          color: getRandomColor(),
        }))
      );
    });

    socket.on("user-typing", ({ username }) => {
      setIsTyping((prev) => [...new Set([...prev, username])]);
      setTimeout(() => {
        setIsTyping((prev) => prev.filter((user) => user !== username));
      }, 3000);
    });

    return () => {
      socket.off("receive-message");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("existing-users");
      socket.off("user-typing");
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        alert("File size should be less than 5MB");
        return;
      }

      setSelectedFile(file);

      // Create preview URL for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const joinCommunity = () => {
    if (username.trim()) {
      const color = getRandomColor();
      setUserColor(color);
      socket.emit("join", username.trim());
      setJoined(true);
    }
  };

  const handleTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit("typing", { username });
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop-typing", { username });
    }, 2000);
  };

  const sendMessage = async () => {
    if (message.trim() || selectedFile) {
      let fileData = null;

      if (selectedFile) {
        const reader = new FileReader();
        fileData = await new Promise((resolve) => {
          reader.onload = (e) => {
            resolve({
              name: selectedFile.name,
              type: selectedFile.type,
              data: e.target.result,
              size: selectedFile.size,
            });
          };
          reader.readAsDataURL(selectedFile);
        });
      }

      const data = {
        username,
        message: message.trim(),
        replyTo,
        userColor,
        timestamp: new Date(),
        file: fileData,
      };

      socket.emit("send-message", data);
      setMessage("");
      setSelectedFile(null);
      setPreviewUrl("");
      setReplyTo(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderFilePreview = (fileData) => {
    if (!fileData) return null;

    if (fileData.type.startsWith("image/")) {
      return (
        <img
          src={fileData.data}
          alt="shared"
          style={{ maxWidth: "200px", maxHeight: "200px", borderRadius: "4px" }}
        />
      );
    }

    return (
      <div className="file-attachment">
        <span>📎 {fileData.name}</span>
        <a
          href={fileData.data}
          download={fileData.name}
          className="download-link"
        >
          Download
        </a>
      </div>
    );
  };

  return (
    <div className="app-container">
      {!joined ? (
        <div className="login-container">
          <div className="login-card">
            <h1>Join the Chat</h1>
            <div className="login-input-group">
              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && joinCommunity()}
              />
              <button onClick={joinCommunity}>Join</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="chat-container">
          <div className="chat-main">
            <div className="chat-messages">
              <h2>Community Chat</h2>
              <div className="messages-list">
                {messages.map((msg, index) => (
                  <div key={index} className="message-item">
                    {msg.replyTo && (
                      <div className="reply-content">
                        <span className="reply-username">
                          {msg.replyTo.username}
                        </span>
                        <span className="reply-text">
                          {msg.replyTo.message}
                        </span>
                      </div>
                    )}
                    <div className="message-content">
                      <div
                        className="avatar"
                        style={{ backgroundColor: msg.userColor }}
                      >
                        {getInitials(msg.username)}
                      </div>
                      <div className="message-body">
                        <div className="message-header">
                          <span className="username">{msg.username}</span>
                          <span className="timestamp">
                            {msg.timestamp && formatTime(msg.timestamp)}
                          </span>
                        </div>
                        {msg.message && <p>{msg.message}</p>}
                        {msg.file && renderFilePreview(msg.file)}
                        <button
                          className="reply-button"
                          onClick={() => setReplyTo(msg)}
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
                {isTyping.length > 0 && (
                  <div className="typing-indicator">
                    {isTyping.join(", ")} {isTyping.length === 1 ? "is" : "are"}{" "}
                    typing...
                  </div>
                )}
              </div>
              {replyTo && (
                <div className="reply-bar">
                  <div className="reply-info">
                    <span>Replying to </span>
                    <strong>{replyTo.username}</strong>
                  </div>
                  <button
                    className="cancel-reply"
                    onClick={() => setReplyTo(null)}
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="input-container">
                <input
                  type="text"
                  placeholder="Type a message"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={handleKeyPress}
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
                <button
                  className="attach-button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  📎
                </button>
                <button onClick={sendMessage}>Send</button>
              </div>
              {previewUrl && (
                <div className="preview-container">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="file-preview"
                  />
                  <button
                    className="cancel-upload"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl("");
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="users-sidebar">
            <h3>Online Users ({users.length})</h3>
            <div className="users-list">
              {users.map((user, index) => (
                <div key={index} className="user-item">
                  <div
                    className="avatar"
                    style={{ backgroundColor: user.color }}
                  >
                    {getInitials(user.username)}
                  </div>
                  <span>{user.username}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <style>{`
        /* Previous styles remain the same */
        * {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  min-height: 100vh;
  background: linear-gradient(to bottom right, #1a1a1a, #2d2d2d);
  padding: 1rem;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.login-card {
  background: #2d2d2d;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

.login-card h1 {
  margin-bottom: 1.5rem;
  text-align: center;
  font-size: 1.5rem;
}

.login-input-group {
  display: flex;
  gap: 0.5rem;
}

.chat-container {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 1rem;
  height: calc(100vh - 2rem);
}

.chat-main {
  background: #2d2d2d;
  border-radius: 8px;
  overflow: hidden;
}

.chat-messages {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-messages h2 {
  padding: 1rem;
  margin: 0;
  border-bottom: 1px solid #404040;
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.message-item {
  margin-bottom: 1rem;
}

.reply-content {
  margin-left: 2.5rem;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background: #404040;
  border-left: 3px solid #666;
  border-radius: 4px;
  font-size: 0.875rem;
}

.reply-username {
  font-weight: 600;
  margin-right: 0.5rem;
}

.message-content {
  display: flex;
  gap: 0.75rem;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.message-body {
  flex: 1;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.username {
  font-weight: 600;
}

.timestamp {
  color: #999;
  font-size: 0.875rem;
}

.reply-button {
  background: none;
  border: none;
  color: #666;
  padding: 0.25rem 0;
  cursor: pointer;
  font-size: 0.875rem;
}

.reply-button:hover {
  color: #fff;
}

.typing-indicator {
  color: #999;
  font-style: italic;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.reply-bar {
  background: #404040;
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reply-info {
  font-size: 0.875rem;
  color: #999;
}

.cancel-reply {
  background: none;
  border: none;
  color: #999;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.25rem;
}

.cancel-reply:hover {
  color: #fff;
}

.input-container {
  padding: 1rem;
  border-top: 1px solid #404040;
  display: flex;
  gap: 0.5rem;
}

input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #404040;
  border-radius: 4px;
  background: #333;
  color: #fff;
  font-size: 0.875rem;
}

input:focus {
  outline: none;
  border-color: #666;
}

button {
  padding: 0.75rem 1.5rem;
  background: #2563eb;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

button:hover {
  background: #1d4ed8;
}

.users-sidebar {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 1rem;
}

.users-sidebar h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 4px;
}

.user-item:hover {
  background: #404040;
}

@media (max-width: 768px) {
  .chat-container {
    grid-template-columns: 1fr;
  }

  .users-sidebar {
    display: none;
  }
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #1a1a1a;
}

::-webkit-scrollbar-thumb {
  background: #404040;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #4a4a4a;
}
        
        .file-attachment {
          background: #404040;
          padding: 0.5rem;
          border-radius: 4px;
          margin-top: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .download-link {
          color: #2563eb;
          text-decoration: none;
          font-size: 0.875rem;
          padding: 0.25rem 0.5rem;
          background: #333;
          border-radius: 4px;
        }

        .download-link:hover {
          background: #404040;
        }

        .attach-button {
          padding: 0.75rem;
          background: none;
          border: 1px solid #404040;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .attach-button:hover {
          background: #404040;
        }

        .preview-container {
          padding: 0.5rem;
          border-top: 1px solid #404040;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .file-preview {
          max-width: 100px;
          max-height: 100px;
          border-radius: 4px;
        }

        .cancel-upload {
          background: none;
          border: none;
          color: #999;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0.25rem;
        }

        .cancel-upload:hover {
          color: #fff;
        }
      `}</style>
    </div>
  );
};

export default App;
