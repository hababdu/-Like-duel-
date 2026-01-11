// frontend/src/components/GenderModal.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useGameStore from '../stores/useGameStore';
import { getSocket } from '../utils/socket';

const GenderModal = () => {
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | null>(null);
  const { user, setUser } = useGameStore();
  const navigate = useNavigate();
  
  const handleGenderSelect = (gender: 'male' | 'female') => {
    setSelectedGender(gender);
    
    // Backendga gender ma'lumotini yuborish
    const socket = getSocket();
    if (socket && user) {
      socket.emit('select_gender', {
        userId: user.id,
        gender
      });
      
      // Local state yangilash
      setUser({ ...user, gender });
      
      // Modal yopish
      document.getElementById('gender-modal')?.classList.add('hidden');
      
      // Queue sahifasiga o'tish
      navigate('/queue');
    }
  };
  
  return (
    <div id="gender-modal" className="modal hidden">
      <div className="modal-content">
        <h3>Select Your Gender</h3>
        <p>This helps us find suitable opponents for you</p>
        
        <div className="gender-options">
          <button 
            onClick={() => handleGenderSelect('male')}
            className={`gender-btn ${selectedGender === 'male' ? 'selected' : ''}`}
          >
            👨 Male
          </button>
          
          <button 
            onClick={() => handleGenderSelect('female')}
            className={`gender-btn ${selectedGender === 'female' ? 'selected' : ''}`}
          >
            👩 Female
          </button>
        </div>
        
        <div className="modal-footer">
          <p className="note">
            Note: You can change this later in your profile settings
          </p>
        </div>
      </div>
    </div>
  );
};

export default GenderModal;