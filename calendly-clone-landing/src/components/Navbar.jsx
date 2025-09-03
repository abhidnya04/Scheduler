export default function Navbar() {
  return (
    <header className="flex justify-between items-center px-8 py-6 shadow-sm bg-white sticky top-0">
      <h1 className="text-2xl font-bold text-blue-600">Schedulr</h1>
      <nav className="space-x-6 font-medium">
        <a href="#features" className="hover:text-blue-600">Features</a>
        <a href="#about" className="hover:text-blue-600">About</a>
        <a href="#contact" className="hover:text-blue-600">Contact</a>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Get Started
        </button>
      </nav>
    </header>
  );
}
