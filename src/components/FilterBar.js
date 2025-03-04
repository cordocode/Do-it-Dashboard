import React from 'react';

const FilterBar = ({ activeFilter, onFilterChange }) => {
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Completed' },
    { id: 'today', label: 'Due Today' },
    { id: 'overdue', label: 'Overdue' }
  ];
  
  return (
    <div className="filter-bar">
      {filters.map(filter => (
        <button
          key={filter.id}
          className={`filter-item ${activeFilter === filter.id ? 'active' : ''}`}
          onClick={() => onFilterChange(filter.id)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
};

export default FilterBar;
