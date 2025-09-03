export default function Features() {
  return (
    <section id="features" className="px-8 py-20 bg-gray-50">
      <h3 className="text-3xl font-bold text-center mb-12">Why Choose Schedulr?</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-6xl mx-auto">
        <div className="p-6 bg-white shadow rounded-2xl">
          <h4 className="text-xl font-semibold mb-3">Google Calendar Sync</h4>
          <p className="text-gray-600">Seamlessly integrates with Google Calendar so you never double-book.</p>
        </div>
        <div className="p-6 bg-white shadow rounded-2xl">
          <h4 className="text-xl font-semibold mb-3">One-Click Scheduling</h4>
          <p className="text-gray-600">Share a link and let others pick a slot that fits your availability.</p>
        </div>
        <div className="p-6 bg-white shadow rounded-2xl">
          <h4 className="text-xl font-semibold mb-3">Reminders & Notifications</h4>
          <p className="text-gray-600">Get automated reminders so you and your guests never miss a meeting.</p>
        </div>
      </div>
    </section>
  );
}
