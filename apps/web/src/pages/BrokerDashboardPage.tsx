export default function BrokerDashboardPage() {
  return (
    <div className="min-h-screen bg-garden-50 flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <div className="text-5xl mb-4">🤝</div>
        <h1 className="text-2xl font-bold text-garden-700">Broker Dashboard</h1>
        <p className="text-gray-500 mt-2 text-sm">
          Multi-producer order coordination is coming soon. Brokers will be able to
          bundle produce from multiple farms into single consumer orders.
        </p>
      </div>
    </div>
  );
}
