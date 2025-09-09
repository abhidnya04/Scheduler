import {
  CalendarIcon,
  ClockIcon,
  PlusIcon,
  UserGroupIcon,
  VideoCameraIcon
} from "@heroicons/react/24/outline";
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const loggedInUserId = queryParams.get("user_id");
  const authorized = queryParams.get("authorized");

  const [user, setUser] = useState(null);
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user data
  useEffect(() => {
    // If an invitee just authorized, stash for later and clean URL (stay on dashboard)
    if (authorized) {
      try {
        localStorage.setItem("authorized_email", authorized);
      } catch {}
      const clean = new URL(window.location.href);
      clean.searchParams.delete("authorized");
      window.history.replaceState({}, "", clean.pathname + clean.search);
    }

    if (loggedInUserId) {
      fetch(`http://localhost:8000/users/${loggedInUserId}`)
        .then((res) => res.json())
        .then((data) => {
          setUser(data);
          // Fetch upcoming meetings for this user
          return fetch(`http://localhost:8000/meetings/upcoming?user_id=${loggedInUserId}`);
        })
        .then((res) => res.json())
        .then((meetings) => {
          setUpcomingMeetings(meetings || []);
        })
        .catch((err) => {
          console.error("Failed to fetch dashboard data:", err);
          setError("Failed to load dashboard data");
        })
        .finally(() => setLoading(false));
    } else {
      // Use dummy data when no user ID is provided
      setUser({
        name: "John Doe",
        email: "john.doe@example.com"
      });
      setUpcomingMeetings([
        {
          title: "Team Standup",
          start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
          duration: 30,
          participants: [
            { email: "alice@example.com" },
            { email: "bob@example.com" }
          ],
          hangout_link: "https://meet.google.com/abc-defg-hij"
        },
        {
          title: "Project Review",
          start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
          duration: 60,
          participants: [
            { email: "manager@example.com" },
            { email: "client@example.com" }
          ],
          hangout_link: "https://meet.google.com/xyz-1234-uvw"
        },
        {
          title: "Weekly Planning",
          start_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
          duration: 45,
          participants: [
            { email: "team@example.com" }
          ]
        }
      ]);
      setLoading(false);
    }
  }, [loggedInUserId]);

  const handleCreateMeeting = () => {
    const authorizedEmail = queryParams.get("authorized") || user?.email;
    if (authorizedEmail) {
      navigate(`/schedule?authorized=${encodeURIComponent(authorizedEmail)}&user_id=${loggedInUserId}`);
    } else {
      navigate(`/schedule?user_id=${loggedInUserId}`);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-blue-600">Schedulr</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {getInitials(user?.name || user?.email)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user?.name || "User"}
                  </p>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name?.split(' ')[0] || "User"}!
          </h2>
          <p className="text-gray-600">
            Here's what's happening with your meetings today.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={handleCreateMeeting}
                className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
                <span>Create New Meeting</span>
              </button>
              <button className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors">
                <CalendarIcon className="w-5 h-5" />
                <span>View Calendar</span>
              </button>
              <button className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors">
                <UserGroupIcon className="w-5 h-5" />
                <span>Manage Contacts</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CalendarIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Upcoming Meetings</p>
                <p className="text-2xl font-bold text-gray-900">{upcomingMeetings.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <ClockIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">This Week</p>
                <p className="text-2xl font-bold text-gray-900">
                  {upcomingMeetings.filter(meeting => {
                    const meetingDate = new Date(meeting.start_time || meeting.date);
                    const now = new Date();
                    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    return meetingDate >= now && meetingDate <= weekFromNow;
                  }).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <VideoCameraIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Meetings</p>
                <p className="text-2xl font-bold text-gray-900">{upcomingMeetings.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Meetings */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Meetings</h3>
          </div>
          
          {upcomingMeetings.length === 0 ? (
            <div className="p-8 text-center">
              <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No upcoming meetings</h4>
              <p className="text-gray-500 mb-4">You don't have any meetings scheduled yet.</p>
              <button
                onClick={handleCreateMeeting}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Schedule Your First Meeting
              </button>
            </div>
          ) : (
            <div className="divide-y">
              {upcomingMeetings.map((meeting, index) => (
                <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-gray-900">
                          {meeting.title || "Untitled Meeting"}
                        </h4>
                        {meeting.hangout_link && (
                          <a
                            href={meeting.hangout_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700"
                          >
                            <VideoCameraIcon className="w-4 h-4" />
                            <span className="text-sm">Join</span>
                          </a>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <CalendarIcon className="w-4 h-4" />
                          <span>{formatDate(meeting.start_time || meeting.date)}</span>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <ClockIcon className="w-4 h-4" />
                          <span>{formatTime(meeting.start_time || meeting.date)}</span>
                        </div>
                        
                        {meeting.duration && (
                          <div className="flex items-center space-x-1">
                            <span>{meeting.duration} min</span>
                          </div>
                        )}
                        
                        {meeting.participants && meeting.participants.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <UserGroupIcon className="w-4 h-4" />
                            <span>{meeting.participants.length} participant{meeting.participants.length !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                      
                      {meeting.participants && meeting.participants.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">
                            With: {meeting.participants.map(p => p.email || p).join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button className="text-gray-400 hover:text-gray-600 p-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
