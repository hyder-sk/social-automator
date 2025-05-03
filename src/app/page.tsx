import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-black">
          Social Automation Tool
        </h1>
        <div className="max-w-2xl mx-auto">
          <p className="text-lg text-gray-600 text-center">
            Automate your social media tasks with ease
          </p>
        </div>
        <div className="flex justify-center space-x-6 mb-8">
          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800"
          >
            Facebook
          </a>
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pink-600 hover:text-pink-800"
          >
            Instagram
          </a>
        </div>
      </main>
    </div>
  );
}
