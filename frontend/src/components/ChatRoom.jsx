// src/components/chat/ChatRoom.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../../contexts/GameContext';

const ChatRoom = ({ roomId }) => {
  const { sendChatMessage } = useGame();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [typing, setTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Oldingi xabarlarni yuklash
    loadMessages();
    
    // WebSocket orqali real-time xabarlarni qabul qilish
    // Bu GameContext orqali amalga oshiriladi
  }, [roomId]);

  useEffect(() => {
    // Xabarlar ro'yxatini pastga skroll qilish
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/chat/${roomId}/messages`);
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    
    try {
      await sendChatMessage(roomId, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Send message error:', error);
      alert('Xabar yuborishda xatolik');
    }
  };

  const handleTyping = () => {
    if (!typing) {
      setTyping(true);
      // Serverga typing status yuborish
      
      setTimeout(() => {
        setTyping(false);
      }, 3000);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-room">
      <div className="chat-header">
        <div className="chat-info">
          <div className="chat-title">💬 O'yin Chat</div>
          <div className="chat-status">
            {typingUsers.length > 0 && (
              <span className="typing-indicator">
                {typingUsers.join(', ')} yozmoqda...
              </span>
            )}
          </div>
        </div>
        <div className="chat-members">
          <span className="member-count">👥 2</span>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>Xabarlar yo'q. Birinchi xabarni yozing!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.messageId}
              className={`message ${message.senderId === 'currentUserId' ? 'sent' : 'received'}`}
            >
              <div className="message-content">
                <div className="message-sender">
                  {message.senderName}
                </div>
                <div className="message-text">
                  {message.text}
                </div>
                <div className="message-time">
                  {formatTime(message.createdAt)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            handleTyping();
          }}
          placeholder="Xabar yozing..."
          maxLength={2000}
        />
        <button type="submit" disabled={!newMessage.trim()}>
          ↗️
        </button>
      </form>
    </div>
  );
};

export default ChatRoom;