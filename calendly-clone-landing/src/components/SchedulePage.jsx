// src/components/SchedulePage.jsx
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

export default function SchedulePage() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get("token"); // <-- get token from URL

  const [date, setDate] = useState(new Date());
  const [title, setTitle] = useState("New Meeting");
  const [duration, setDuration] = useState(30);
  const [slotWindow, setSlotWindow] = useState("before_lunch");
  const [emails, setEmails] = useState("");

  useEffect(() => {
    if (token) {
      console.log("✅ Google OAuth Token:", token);
      // later: use this token to fetch events from Google Calendar
    }
  }, [token]);

  const handleFindSlot = async () => {
    const payload = {
      emails: emails.split(",").map((e) => e.trim()),
      date: date.toISOString().split("T")[0],
      slot_window: slotWindow,
      duration,
      title,
    };

    const res = await fetch("http://localhost:8000/meetings/find-slot", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // ✅ send token to backend
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("Response:", data);
    alert("Meeting request sent! Check console.");
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Preview */}
      <div className="w-1/2 p-8 bg-gray-50 border-r">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        <p className="mb-2">Duration: {duration} min</p>
        <p className="mb-2">
          Slot:{" "}
          {slotWindow === "before_lunch"
            ? "Before Lunch (9–12:30)"
            : "After Lunch (13:30–18:00)"}
        </p>
        <p className="mb-2">Members: {emails}</p>
        <Calendar value={date} onChange={setDate} />
      </div>

      {/* Right Form */}
      <div className="w-1/2 p-8">
        <h3 className="text-xl font-bold mb-6">Meeting Details</h3>

        <label className="block mb-4">
          <span className="text-gray-700">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border p-2 rounded mt-1"
          />
        </label>

        <label className="block mb-4">
          <span className="text-gray-700">Duration</span>
          <select
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full border p-2 rounded mt-1"
          >
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </label>

        <label className="block mb-4">
          <span className="text-gray-700">Slot Window</span>
          <select
            value={slotWindow}
            onChange={(e) => setSlotWindow(e.target.value)}
            className="w-full border p-2 rounded mt-1"
          >
            <option value="before_lunch">Before Lunch</option>
            <option value="after_lunch">After Lunch</option>
          </select>
        </label>

        <label className="block mb-4">
          <span className="text-gray-700">Invitee Emails (comma separated)</span>
          <input
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            className="w-full border p-2 rounded mt-1"
          />
        </label>

        <button
          onClick={handleFindSlot}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          Find Slot
        </button>
      </div>
    </div>
  );
}
