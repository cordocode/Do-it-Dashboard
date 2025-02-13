import React, { useState } from 'react';

// Confirmation Popup Component
const ConfirmationPopup = ({ onConfirm, onCancel }) => {
  return (
    <div style={{ 
      position: 'absolute', 
      backgroundColor: 'white', 
      border: '1px solid black',
      padding: '5px'
    }}>
      <button onClick={onConfirm}>✓</button>
      <button onClick={onCancel}>✗</button>
    </div>
  );
};

// Individual Box component
const Box = ({ id, onDelete }) => {
  const [text, setText] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleTextChange = (e) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const handleDeleteClick = () => {
    setShowConfirmation(true);
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        value={text}
        onChange={handleTextChange}
        style={{
          resize: 'none',
          overflow: 'hidden',
          minHeight: '20px',
          width: '200px'
        }}
      />
      <button onClick={handleDeleteClick}>-</button>
      {showConfirmation && (
        <ConfirmationPopup
          onConfirm={() => onDelete(id)}
          onCancel={() => setShowConfirmation(false)}
        />
      )}
    </div>
  );
};

// Main Dashboard component
const DashboardPage = () => {
  const [boxes, setBoxes] = useState([]);

  // Add box endpoint
  const addBox = () => {
    setBoxes([...boxes, { id: Date.now() }]);
  };

  // Delete box endpoint
  const deleteBox = (boxId) => {
    setBoxes(boxes.filter(box => box.id !== boxId));
  };

  return (
    <div>
      <button onClick={addBox}>Add Box</button>
      {boxes.map(box => (
        <Box
          key={box.id}
          id={box.id}
          onDelete={deleteBox}
        />
      ))}
    </div>
  );
};

export default DashboardPage;
