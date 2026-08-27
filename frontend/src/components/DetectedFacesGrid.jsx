import React from 'react';

export default function DetectedFacesGrid({ detectedFaces = [] }) {
  const dummyFaces = [
    { id: 1, name: "Alice Smith", rollNo: "101", confidence: "98%", status: "Matched", image: "https://via.placeholder.com/150" },
    { id: 2, name: "Bob Johnson", rollNo: "102", confidence: "94%", status: "Matched", image: "https://via.placeholder.com/150" },
    { id: 3, name: "Unknown", rollNo: "N/A", confidence: "45%", status: "Unrecognized", image: "https://via.placeholder.com/150" },
  ];

  const facesToDisplay = detectedFaces.length > 0 ? detectedFaces : dummyFaces;

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 max-w-5xl mx-auto mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Detected Faces</h2>
        <span className="text-sm font-medium px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full">
          Total Detected: {facesToDisplay.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {facesToDisplay.map((face) => (
          <div
            key={face.id}
            className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col items-center shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="relative w-24 h-24 mb-3">
              <img
                src={face.image}
                alt={`Detected face ${face.id}`}
                className="w-full h-full object-cover rounded-full border-2 border-indigo-500 shadow"
              />
              <span
                className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
                  face.status === "Matched" ? "bg-green-500" : "bg-red-500"
                }`}
                title={face.status}
              />
            </div>

            <h3 className="font-semibold text-gray-800 text-base text-center truncate w-full">
              {face.name}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Roll No: <span className="font-medium text-gray-700">{face.rollNo}</span>
            </p>

            <div className="mt-3 flex items-center justify-between w-full text-xs border-t border-gray-200 pt-2">
              <span className="text-gray-500">Confidence:</span>
              <span className="font-semibold text-indigo-600">{face.confidence}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}