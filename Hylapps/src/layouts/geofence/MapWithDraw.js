import React, { useRef,useState,useEffect   } from 'react';

import { FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import Swal from 'sweetalert2';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import './geofencepopup.css';

const MapWithDraw = () => {
  const featureGroupRef = useRef(null);
  const [geofenceTypes, setGeofenceTypes] = useState([]);
  const geofenceTypesRef = useRef(geofenceTypes);

  useEffect(() => {
    // Fetch geofence types from the server on mount
    const fetchGeofenceTypes = async () => {
      try {
        const baseURL = process.env.REACT_APP_API_BASE_URL;
        const response = await axios.get(`${baseURL}/api/get-geofence-types`);
        // console.log(response.data[0].geofenceType);
        // Assuming response.data contains the array of geofence types
        if (response.data.length > 0 && response.data[0].geofenceType) {
          setGeofenceTypes(response.data[0].geofenceType); // Extract the geofenceType array

        } else {
          console.error('No geofence types found in the database.');
        }
      } catch (error) {
        console.error('Error fetching geofence types:', error);
      }
    };

    fetchGeofenceTypes();
  }, []);

  useEffect(() => {
    // Whenever geofenceTypes changes, update the ref to hold the latest value
    geofenceTypesRef.current = geofenceTypes;
  }, [geofenceTypes]);
  


  const handleCreated = (e) => {
    const { layer } = e;

    if (layer instanceof L.Polygon || layer instanceof L.Circle || layer instanceof L.Polyline) {
      const todayDate = new Date().toISOString().split('T')[0];
      const autoGeneratedGeofenceId = `GF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const popupContent = L.DomUtil.create('div');
      popupContent.innerHTML = `
        <form id="popup-form" style="width: 250px; display: flex; flex-direction: column;">
          <div class="property-row">
            <label for="geofence-id">Geofence ID:</label>
            <input type="text" id="geofence-id" value="${autoGeneratedGeofenceId}" class="property-id" disabled />
          </div>
          <div class="property-row">
            <label for="geofence-name">Geofence Name:</label>
            <input type="text" id="geofence-name" class="property-name" placeholder="Enter Geofence Name" required />
          </div>
          <div class="property-row">
            <label for="geofence-type">Geofence Type:</label>
        <select id="geofence-type" class="geofence-type" required>
              <option value="" disabled selected>Select Type</option>
              ${geofenceTypesRef.current
                .map((type) => `<option value="${type}">${type}</option>`)
                .join('')}
            </select>
          </div>
          <div class="property-row">
            <label for="date">Date:</label>
            <input type="date" id="date" value="${todayDate}" disabled />
          </div>
          <div class="property-row">
            <label for="remarks">Remarks:</label>
            <textarea id="remarks" class="remarks" placeholder="Enter description" required></textarea>
          </div>
          <div class="buttons-row" style="display: flex; justify-content: space-between;">
            <button type="button" id="cancel-btn" class="cancel-btn">Cancel</button>
            <button type="submit" class="submit-btn">Save</button>
          </div>
        </form>
      `;

      layer.bindPopup(popupContent).openPopup();

      const form = popupContent.querySelector('#popup-form');
      const cancelBtn = popupContent.querySelector('#cancel-btn');

      // Attach form submit event
      form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent the default form submission

        let coordinates;
        if (layer instanceof L.Circle) {
          const center = layer.getLatLng();
          const radius = layer.getRadius();
          if (radius <= 0) {
            Swal.fire('Error', 'Circle radius must be greater than zero.', 'error');
            return;
          }
          coordinates = [{ lat: center.lat, lng: center.lng, radius }];
        } else if (layer instanceof L.Polygon) {
          coordinates = layer.getLatLngs()[0].map(latlng => ({ lat: latlng.lng, lng: latlng.lat }));
        } else if (layer instanceof L.Polyline) {
          coordinates = layer.getLatLngs().map(latlng => ({ lat: latlng.lat, lng: latlng.lng }));
        }

        const formData = {
          geofenceId: form.querySelector('#geofence-id').value,
          geofenceName: form.querySelector('#geofence-name').value,
          geofenceType: form.querySelector('#geofence-type').value,
          date: form.querySelector('#date').value,
          remarks: form.querySelector('#remarks').value,
          coordinates,
        };

        if (!formData.geofenceName || !formData.geofenceType || !formData.remarks) {
          Swal.fire('Error', 'Please fill out all fields!', 'error');
          return;
        }

        try {
          const baseURL = process.env.REACT_APP_API_BASE_URL;
          const endpoint = layer instanceof L.Polygon
            ? `${baseURL}/api/addpolygongeofences`
            : layer instanceof L.Circle
            ? `${baseURL}/api/addcirclegeofences`
            : `${baseURL}/api/addpolylinegeofences`;

          const response = await axios.post(endpoint, formData);
          // console.log(response);
      

          if (response.status === 201) {
            Swal.fire('Success', 'Geofence saved successfully!', 'success').then(() => {
              layer.closePopup();
              window.location.reload(); // Reload the page after "OK" is clicked
            });
          } else {
            throw new Error('Unexpected response status: ' + response.status);
          }
        } catch (error) {
          console.error('Error saving geofence:', error);
          Swal.fire('Error', 'Failed to save geofence data. ' + (error.response?.data?.error || 'Please try again.'), 'error');
        }
      });

      // Attach cancel button event
      cancelBtn.addEventListener('click', () => {
        layer.closePopup();
      });
    }
  };

  return (
    
    <FeatureGroup ref={featureGroupRef}>
      
      <EditControl
        position="topright"
        onCreated={handleCreated}
        draw={{
          rectangle: true,
          marker: false,
          circlemarker: false,
          polygon: true,
          // polygon: {
          //   allowIntersection: true, // Restrict self-intersections
          //   shapeOptions: {
          //     color: 'red', // Custom color for polygon
          //   },
          // },
          polygon: {
            icon: L.icon({
              iconUrl: 'https://static.vecteezy.com/system/resources/previews/016/314/339/original/red-circle-red-dot-icon-free-png.png', // Custom icon for the point
              iconSize: [10, 12], // Icon size
              // iconAnchor: [10, 10], // Point where the icon is anchored
              // // popupAnchor: [-3, -76] // Point where the popup opens
            }),
          },
          polyline: true,
          polyline: {
            icon: L.icon({
              iconUrl: 'https://static.vecteezy.com/system/resources/previews/016/314/339/original/red-circle-red-dot-icon-free-png.png', 
              iconSize: [15, 15], 
             
            }),
          },
          circle: true,
          // polyline:true,
          // polyline: {
          //   icon: L.icon({
          //     iconUrl: 'https://static.vecteezy.com/system/resources/previews/016/314/339/original/red-circle-red-dot-icon-free-png.png', 
          //     iconSize: [15, 15], 
             
          //   }),
          // },
        }}
      />
    </FeatureGroup>
  );
};

export default MapWithDraw;
