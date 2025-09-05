// src/components/SchedulePage.jsx
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

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
      date: date.toISOString().split("T")[0],
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

  const inviteeList = emails
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

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
        date: date.toISOString().split("T")[0],
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

  return (
    <div className="flex min-h-screen">
      {/* Left Preview */}
      <div className="w-1/2 p-8 bg-gray-50 border-r">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        <p className="mb-2">Duration: {duration} min</p>
        <p className="mb-2">
          {slotWindow === "before_lunch"
            ? "Before Lunch (9–12:30)"
            : "After Lunch (13:30–18:00)"}
        </p>
        <p className="mb-2">Members:</p>
        <ul>
          {emails.split(",").map((raw) => {
            const e = raw.trim();
            if (!e) return null;
            const isAuthorized = authorizedEmails.includes(e);
            return (
              <li key={e}>
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
          <span className="text-gray-700">
            Invitee Emails (comma separated)
          </span>
          <input
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            className="w-full border p-2 rounded mt-1"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSendInvites}
            className="px-5 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Send Access Invites
          </button>

          <button
            onClick={handleScheduleMeeting}
            disabled={!isAllAuthorized || !hostEmail || scheduling}
            className={`px-5 py-2 rounded-lg text-white ${
              isAllAuthorized && hostEmail && !scheduling
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {scheduling ? "Scheduling..." : "Schedule Meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}
