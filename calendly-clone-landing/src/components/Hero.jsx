export default function Hero() {
  return (
    <section className="flex flex-col lg:flex-row items-center justify-between px-8 py-20 max-w-6xl mx-auto">
      <div className="lg:w-1/2 space-y-6">
        <h2 className="text-5xl font-bold leading-tight">
          Schedule meetings <span className="text-blue-600">effortlessly</span>
        </h2>
        <p className="text-lg text-gray-600">
          Schedulr helps you sync with Google Calendar, share availability, 
          and book meetings without back-and-forth emails.
        </p>
        <div className="flex space-x-4">
          <button
  onClick={() => {
    window.location.href = "http://localhost:8000/auth/google";
  }}
  className="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg hover:bg-blue-700"
>
  Try for Free
</button>
          <button className="border border-blue-600 text-blue-600 px-6 py-3 rounded-lg text-lg hover:bg-blue-50">
            Learn More
          </button>
        </div>
      </div>
      <div className="lg:w-1/2 mt-10 lg:mt-0">
        <img
          src="https://illustrations.popsy.co/blue/shaking-hands.svg"
          alt="Scheduling illustration"
          className="w-full max-w-lg mx-auto"
        />
      </div>
    </section>
  );
}
