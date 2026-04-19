import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').trim(),
  role: z.enum(['consumer', 'producer', 'broker']),
  locationZip: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const ROLE_LABELS: Record<string, string> = {
  consumer: 'Consumer — buying local produce',
  producer: 'Producer — selling / growing',
  broker:   'Broker — connecting buyers and sellers',
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const register_ = useAuthStore((s) => s.register);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'consumer' },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await register_(data);
      navigate('/', { replace: true });
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
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              {...register('name')}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-garden-500"
              placeholder="Jane Smith"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              {...register('email')}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-garden-500"
              placeholder="you@example.com"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              {...register('password')}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-garden-500"
              placeholder="Min. 8 characters"
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">I am a</label>
            <select
              {...register('role')}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-garden-500 bg-white"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ZIP code{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
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
          <Link to="/login" className="text-garden-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
