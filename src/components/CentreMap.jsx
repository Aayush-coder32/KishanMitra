import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Badge, money } from "./UI";
export default function CentreMap({ data, national = false }) {
  return (
    <div className="centre-map">
      <MapContainer
        center={national ? [23.6, 80] : [26.95, 80.84]}
        zoom={national ? 4 : 9}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {data.centres.map((c) => {
          const queue = data.slots.filter(
            (s) =>
              s.centreId === c._id &&
              !["COMPLETED", "CANCELLED"].includes(s.status),
          ).length;
          const volume = data.procurements
            .filter((p) => p.centreId === c._id)
            .reduce((sum, p) => sum + p.quantity, 0);
          return (
            <CircleMarker
              key={c._id}
              center={[c.latitude, c.longitude]}
              radius={national ? 8 : 11}
              pathOptions={{
                color: c.status === "Closed" ? "#a06752" : "#417341",
                fillColor: queue > 8 ? "#c5a047" : "#6b9655",
                fillOpacity: 0.85,
                weight: 3,
              }}
            >
              <Popup>
                <strong>{c.name}</strong>
                <p>
                  {c.district}, {c.state}
                </p>
                <p>
                  {queue} active bookings · {volume} q procured
                </p>
                <p>Capacity: {c.capacity} farmers per window</p>
                <Badge>{c.status}</Badge>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
