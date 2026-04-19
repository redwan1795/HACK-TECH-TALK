import { Link } from 'react-router-dom';

const PRODUCER_BENEFITS = [
  { icon: '🌱', title: 'Reach local buyers', desc: 'List your produce and connect with neighbors who want fresh, local food.' },
  { icon: '💰', title: 'No middleman fees', desc: 'Keep more of what you earn — set your own prices and exchange terms.' },
  { icon: '📦', title: 'Flexible fulfillment', desc: 'Choose to deliver or set a pickup time and location that works for you.' },
  { icon: '📊', title: 'Manage your listings', desc: 'Publish, update, or pause listings from your producer dashboard.' },
];

const CONSUMER_BENEFITS = [
  { icon: '🥕', title: 'Fresh from your neighborhood', desc: 'Buy directly from local growers — no supermarket supply chain.' },
  { icon: '🤝', title: 'Know your grower', desc: 'See who grew your food and how they grow it.' },
  { icon: '🔍', title: 'Find exactly what you need', desc: 'Search by keyword, category, or ZIP code with distance filtering.' },
  { icon: '🚚', title: 'Delivery or pickup', desc: 'Choose listings that deliver to your door or are available for pickup.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-garden-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌿</span>
          <span className="font-bold text-garden-700 text-lg">Community Garden</span>
        </div>
        <Link
          to="/login"
          className="text-sm font-medium text-garden-600 hover:text-garden-700 border border-garden-300 px-4 py-1.5 rounded-lg hover:bg-garden-50 transition-colors"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 py-16 max-w-2xl mx-auto">
        <h1 className="text-4xl font-extrabold text-garden-800 leading-tight mb-4">
          Grow Together.<br />Eat Fresh.
        </h1>
        <p className="text-gray-500 text-lg mb-8 max-w-lg">
          A local marketplace connecting home growers and small farmers with consumers
          who care about where their food comes from.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Link
            to="/register"
            state={{ role: 'producer' }}
            className="bg-garden-600 hover:bg-garden-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors text-center"
          >
            Join as Producer
          </Link>
          <Link
            to="/register"
            state={{ role: 'consumer' }}
            className="bg-white border border-garden-300 hover:bg-garden-50 text-garden-700 font-semibold px-6 py-3 rounded-xl text-sm transition-colors text-center"
          >
            Join as Consumer
          </Link>
        </div>
        <Link
          to="/login"
          className="mt-4 text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2"
        >
          Skip — already have an account? Sign In
        </Link>
      </section>

      {/* Value props */}
      <section className="max-w-5xl mx-auto w-full px-6 pb-16 grid sm:grid-cols-2 gap-8">
        {/* Producers */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-2xl">🌾</span>
            <h2 className="text-lg font-bold text-garden-700">For Producers</h2>
          </div>
          <ul className="space-y-4">
            {PRODUCER_BENEFITS.map((b) => (
              <li key={b.title} className="flex gap-3">
                <span className="text-xl shrink-0">{b.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{b.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{b.desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link
            to="/register"
            state={{ role: 'producer' }}
            className="mt-6 block text-center bg-garden-600 hover:bg-garden-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            Start selling
          </Link>
        </div>

        {/* Consumers */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-2xl">🛒</span>
            <h2 className="text-lg font-bold text-garden-700">For Consumers</h2>
          </div>
          <ul className="space-y-4">
            {CONSUMER_BENEFITS.map((b) => (
              <li key={b.title} className="flex gap-3">
                <span className="text-xl shrink-0">{b.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{b.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{b.desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link
            to="/register"
            state={{ role: 'consumer' }}
            className="mt-6 block text-center bg-white border border-garden-300 hover:bg-garden-50 text-garden-700 font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            Start shopping
          </Link>
        </div>
      </section>

      {/* Did You Know stats */}
      <section className="max-w-5xl mx-auto w-full px-6 pb-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-garden-700 text-white rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-garden-200">Did you know?</p>
          <p className="text-sm leading-relaxed">
            <span className="font-extrabold text-2xl text-white block mb-1">99%+</span>
            of cash spent on food in New Mexico goes to <strong>imported</strong> food products —
            and most of what New Mexico produces is exported out of state.
          </p>
          <p className="text-garden-200 text-xs font-medium mt-auto pt-3 border-t border-garden-600">
            Start producing local and consuming local.
          </p>
        </div>

        <div className="bg-amber-600 text-white rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-200">Did you know?</p>
          <p className="text-sm leading-relaxed">
            New Mexico has <strong>50 farmers markets</strong> with over{' '}
            <strong>25,700 customers</strong> among a 2.1 million population, and about{' '}
            <strong>15 community supported agriculture</strong> locations.
          </p>
          <p className="text-amber-200 text-xs font-medium mt-auto pt-3 border-t border-amber-500">
            Start buying and selling here in Community Garden.
          </p>
        </div>

        <div className="bg-emerald-700 text-white rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">Did you know?</p>
          <p className="text-sm leading-relaxed">
            <span className="font-extrabold text-2xl text-white block mb-1">$1.60</span>
            in total local economic activity is generated for every <strong>$1 spent on local food</strong> — keeping wealth circulating in your community.
          </p>
          <p className="text-emerald-200 text-xs font-medium mt-auto pt-3 border-t border-emerald-600">
            Produce and buy locally — contribute to the economy.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-100 bg-white px-6 py-4 text-center text-xs text-gray-400">
        Community Garden &copy; {new Date().getFullYear()} &mdash;{' '}
        <Link to="/login" className="underline hover:text-gray-600">
          Sign In
        </Link>{' '}
        &middot;{' '}
        <Link to="/register" className="underline hover:text-gray-600">
          Register
        </Link>
      </footer>
    </div>
  );
}
