// src/components/SchedulePage.jsx
import { CalendarIcon, ClockIcon, EnvelopeIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { useLocation } from "react-router-dom";
import "./calendar-style.css";

export default function SchedulePage() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const loggedInUserId = queryParams.get("user_id");

  const [date, setDate] = useState(new Date());
  const [title, setTitle] = useState("New Meeting");
  const [duration, setDuration] = useState(30);
  const [slotWindow, setSlotWindow] = useState("before_lunch");
  const [emails, setEmails] = useState("");
  const [authorizedEmails, setAuthorizedEmails] = useState([]);
  const [hostEmail, setHostEmail] = useState("");
  const [loadingHost, setLoadingHost] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // restore saved emails on first render
  useEffect(() => {
    const savedEmails = localStorage.getItem("invite_emails");
    if (savedEmails) {
      setEmails(savedEmails);
    }
  }, []);

  // save emails whenever they change
  useEffect(() => {
    if (emails) {
      localStorage.setItem("invite_emails", emails);
    } else {
      localStorage.removeItem("invite_emails");
    }
  }, [emails]);

  // When an invitee completes OAuth, they get redirected here with ?authorized=email
  useEffect(() => {
    const authorized = queryParams.get("authorized");
    if (authorized) {
      const decoded = decodeURIComponent(authorized);

      setAuthorizedEmails((prev) => {
        if (prev.includes(decoded)) return prev;
        return [...prev, decoded];
      });

      // ✅ Clear the text field
      setEmails("");

      // ✅ Remove saved emails from localStorage
      localStorage.removeItem("invite_emails");

      // ✅ Clean up URL (remove ?authorized=...)
      window.history.replaceState({}, "", location.pathname);
    }
  }, [location.search]);

  // Fetch current logged-in user's email
  useEffect(() => {
    if (loggedInUserId) {
      fetch(`http://localhost:8000/users/${loggedInUserId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.email) setHostEmail(data.email);
        })
        .catch((err) => console.error("Failed to fetch host email:", err))
        .finally(() => setLoadingHost(false));
    } else {
      setLoadingHost(false);
    }
  }, [loggedInUserId]);

  // Check which emails are already registered
  useEffect(() => {
    const list = emails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    list.forEach((email) => {
      fetch(
        `http://localhost:8000/users/by-email?email=${encodeURIComponent(
          email
        )}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.email && !authorizedEmails.includes(data.email)) {
            setAuthorizedEmails((prev) => [...prev, data.email]);
          }
        })
        .catch(console.error);
    });
  }, [emails]);

  // ----- Dummy Slots Generation (UI only) -----
  const minutesToTimeString = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getWindowRangeMinutes = (windowKey) => {
    // Returns [startMin, endMin) in minutes from 00:00
    if (windowKey === "before_lunch") {
      // 09:00 → 12:30
      return [9 * 60, 12 * 60 + 30];
    }
    // after lunch: 13:30 → 18:00
    return [13 * 60 + 30, 18 * 60];
  };

  const generateDummySlots = (currentDate, slotDuration, windowKey) => {
    const [startMin, endMin] = getWindowRangeMinutes(windowKey);
    const slots = [];
    for (let start = startMin; start + slotDuration <= endMin; start += slotDuration) {
      const end = start + slotDuration;
      slots.push({
        id: `${currentDate.toDateString()}-${start}-${slotDuration}-${windowKey}`,
        start,
        end,
        label: `${minutesToTimeString(start)} – ${minutesToTimeString(end)}`,
      });
    }
    return slots;
  };

  useEffect(() => {
    setSelectedSlot(null);
    const slots = generateDummySlots(date, duration, slotWindow);
    setAvailableSlots(slots);
  }, [date, duration, slotWindow]);

  const handleSendInvites = async () => {
    const list = emails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    if (!list.length) {
      alert("Enter at least one email");
      return;
    }

    const payload = {
      emails: list,
      title,
      date: date.toLocaleDateString("en-CA"), // gives YYYY-MM-DD in local timezone

      duration,
      slot_window: slotWindow,
      host_email: hostEmail || "host@example.com",
    };

    const res = await fetch("http://localhost:8000/invites/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("invites/send:", data);
    alert("Invite emails queued (check console for results).");
  };

  const inviteeList = [
    ...new Set([
      ...emails
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
      ...authorizedEmails, // keep already authorized users
    ]),
  ];

  const isAllAuthorized =
    inviteeList.length > 0 &&
    inviteeList.every((e) => authorizedEmails.includes(e));

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleScheduleMeeting = async () => {
    if (!hostEmail) {
      alert("Host email not loaded yet.");
      return;
    }
    if (!isAllAuthorized) {
      alert("All invitees must be authorized first.");
      return;
    }

    setScheduling(true);
    try {
      const payload = {
        emails: inviteeList,
        title,
        date: date.toLocaleDateString("en-CA"), // gives YYYY-MM-DD in local timezone
        duration,
        slot_window: slotWindow,
        host_email: hostEmail,
        timezone,
      };

      const res = await fetch("http://localhost:8000/schedule-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data?.hangoutLink) {
        alert(`Meeting scheduled!\n\nMeet link: ${data.hangoutLink}`);
        window.open(data.hangoutLink, "_blank");
      } else {
        alert(data?.error || "Failed to schedule meeting.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error while scheduling meeting.");
    } finally {
      setScheduling(false);
    }
  };

  const formattedDate = date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-2">
              {/* <CalendarIcon className="w-7 h-7 text-blue-600" /> */}
              <h1 className="text-3xl font-bold text-blue-600">Schedulr</h1>
            </div>
            <div className="text-sm text-gray-500">{hostEmail || ""}</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title Row */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Schedule a Meeting</h2>
          <p className="text-gray-600">Pick a date, choose a slot, and add participants.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Calendar + Slots */}
          <section className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Availability</h3>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  <span className="inline-flex items-center gap-1"><CalendarIcon className="w-4 h-4" />{formattedDate}</span>
                  <span className="inline-flex items-center gap-1"><ClockIcon className="w-4 h-4" />{duration} min</span>
                  <span className="inline-flex items-center gap-1"><ClockIcon className="w-4 h-4" />{slotWindow === "before_lunch" ? "Before lunch" : "After lunch"}</span>
                </div>
              </div>
            </div>
            <div className="p-6">
              <Calendar className="custom-calendar" value={date} onChange={setDate} />

              {/* Slots */}
              <div className="mt-6">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="inline-flex items-center gap-2">
                    <ClockIcon className="w-5 h-5 text-gray-700" />
                    <h4 className="text-md font-semibold text-gray-900">Available time slots</h4>
                  </div>
                  <span className="text-sm text-gray-500">
                    {slotWindow === "before_lunch" ? "Before lunch" : "After lunch"} · {duration} min
                  </span>
                </div>

                {availableSlots.length === 0 ? (
                  <p className="text-gray-500">No slots available for this configuration.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedSlot && selectedSlot.id === slot.id;
                      return (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedSlot(slot)}
                          className={`px-3 py-2 rounded-full border text-sm transition-colors ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-gray-800 border-gray-300 hover:border-indigo-400 hover:bg-indigo-100 hover:text-indigo-900"
                          }`}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedSlot && (
                  <div className="mt-3 text-sm text-gray-700">
                    Selected: <span className="font-medium">{selectedSlot.label}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Right: Meeting Details */}
          <section className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                <UserGroupIcon className="w-5 h-5 text-gray-700" />
                <h3 className="text-lg font-semibold text-gray-900">Meeting Details</h3>
              </div>
            </div>
            <div className="p-6">
              <label className="block mb-4">
                <span className="text-gray-700">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border p-2 rounded mt-1"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block mb-2 sm:mb-0">
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

                <label className="block">
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
              </div>

              <label className="block mt-4 mb-4">
                <span className="text-gray-700">Invitee Emails (comma separated)</span>
                <input
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  className="w-full border p-2 rounded mt-1"
                  placeholder="alice@example.com, bob@example.com"
                />
              </label>

              <div className="mb-4">
                <span className="text-gray-700 inline-flex items-center gap-2"><UserGroupIcon className="w-4 h-4" />Participants</span>
                <ul className="mt-2 space-y-1">
                  {inviteeList.map((e) => {
                    const isAuthorized = authorizedEmails.includes(e);
                    return (
                      <li key={e} className="text-sm text-gray-700">
                        {e}{" "}
                        {isAuthorized ? (
                          <span className="text-green-600">✅ Authorized</span>
                        ) : (
                          <span className="text-red-500">❌ Not authorized</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleSendInvites}
                  className="px-5 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 inline-flex items-center gap-2"
                >
                  <EnvelopeIcon className="w-5 h-5" />
                  Send Access Invites
                </button>

                <button
                  onClick={handleScheduleMeeting}
                  disabled={!isAllAuthorized || !hostEmail || scheduling}
                  className={`px-5 py-2 rounded-lg text-white inline-flex items-center gap-2 ${
                    isAllAuthorized && hostEmail && !scheduling
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-gray-300 cursor-not-allowed"
                  }`}
                >
                  <CalendarIcon className="w-5 h-5" />
                  {scheduling ? "Scheduling..." : "Schedule Meeting"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
