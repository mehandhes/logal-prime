import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';

const VehicleContext = createContext(null);

export function VehicleProvider({ children }) {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  useEffect(() => {
    if (user) {
      api.get('/vehicles').then(res => {
        setVehicles(res.data);
        if (res.data.length > 0 && !selectedVehicle) {
          setSelectedVehicle(res.data[0]);
        }
      }).catch(() => {});
    }
  }, [user]);

  return (
    <VehicleContext.Provider value={{ vehicles, setVehicles, selectedVehicle, setSelectedVehicle }}>
      {children}
    </VehicleContext.Provider>
  );
}

export const useVehicles = () => useContext(VehicleContext);
