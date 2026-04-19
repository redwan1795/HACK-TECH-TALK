import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').trim(),
  role: z.enum(['consumer', 'producer']),
  locationZip: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const register_ = useAuthStore((s) => s.register);

  const prefilledRole = (location.state as { role?: string } | null)?.role;
  const defaultRole = prefilledRole === 'producer' ? 'producer' : 'consumer';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: defaultRole },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await register_(data);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Registration failed. Please try again.';
      setError('root', { message: msg });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-garden-50 py-8">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-md">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🌱</div>
          <h1 className="text-2xl font-bold text-garden-700">Create account</h1>
          <p className="text-sm text-gray-400 mt-1">
            All members can both buy and sell.
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              id="reg-name"
              {...register('name')}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-garden-500"
              placeholder="Jane Smith"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="reg-email"
              type="email"
              {...register('email')}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-garden-500"
              placeholder="you@example.com"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              id="reg-password"
              type="password"
              {...register('password')}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-garden-500"
              placeholder="Min. 8 characters"
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
          </div>

          {/* Role is stored as a preference, not an access gate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How will you primarily use Community Garden?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'consumer', icon: '🛒', label: 'Buy', sub: 'Browse & purchase local produce' },
                { value: 'producer', icon: '🌾', label: 'Sell', sub: 'List your garden harvest' },
              ] as const).map(({ value, icon, label, sub }) => (
                <label
                  key={value}
                  className="relative cursor-pointer"
                >
                  <input
                    type="radio"
                    value={value}
                    {...register('role')}
                    className="peer sr-only"
                  />
                  <div className="border-2 rounded-xl p-3 text-center transition-colors peer-checked:border-garden-500 peer-checked:bg-garden-50 border-gray-200 hover:border-garden-300">
                    <div className="text-2xl mb-1">{icon}</div>
                    <p className="font-semibold text-sm text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              You can do both regardless of your selection.
            </p>
          </div>

          <div>
            <label htmlFor="reg-zip" className="block text-sm font-medium text-gray-700 mb-1">
              ZIP code <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="reg-zip"
              {...register('locationZip')}
              placeholder="e.g. 88001"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-garden-500"
            />
          </div>

          {errors.root && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 p-2 rounded">
              {errors.root.message}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-garden-600 hover:bg-garden-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-garden-600 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
