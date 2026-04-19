import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { NavHeader } from '../components/NavHeader';
import type { UserRole } from '@community-garden/types';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').trim(),
  roles: z
    .array(z.enum(['consumer', 'producer']))
    .min(1, 'Select at least one option'),
  locationZip: z.string().optional(),
  agreeToTerms: z
    .boolean()
    .refine((v) => v === true, 'You must agree to continue'),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const register_ = useAuthStore((s) => s.register);

  const prefilledRole = (location.state as { role?: string } | null)?.role;
  const defaultRoles: Array<'consumer' | 'producer'> =
    prefilledRole === 'producer' ? ['producer'] : ['consumer'];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { roles: defaultRoles, agreeToTerms: false },
  });

  const onSubmit = async (data: FormData) => {
    const role: UserRole = data.roles.includes('producer') ? 'producer' : 'consumer';
    try {
      await register_({ ...data, role });
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Registration failed. Please try again.';
      setError('root', { message: msg });
    }
  };

  return (
    <div className="min-h-screen bg-garden-50">
      <NavHeader backHref="/" />
      <div className="flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-md">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🌱</div>
            <h1 className="text-2xl font-bold text-garden-700">Create account</h1>
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

            {/* Role — both options independently selectable */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How will you use Community Garden? <span className="text-gray-400 font-normal">(select all that apply)</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'consumer', icon: '🛒', label: 'Buy', sub: 'Browse & purchase local produce' },
                  { value: 'producer', icon: '🌾', label: 'Sell', sub: 'List your garden harvest' },
                ] as const).map(({ value, icon, label, sub }) => (
                  <label key={value} className="relative cursor-pointer">
                    <input
                      type="checkbox"
                      value={value}
                      {...register('roles')}
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
              {errors.roles && (
                <p className="text-red-500 text-sm mt-1">{errors.roles.message}</p>
              )}
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

            {/* Legal disclaimer */}
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 text-xs text-gray-600 space-y-2">
              <p className="font-semibold text-amber-800 text-sm">Food Safety & Legal Notice</p>
              <p>
                <strong>Producers (sellers)</strong> are solely responsible for ensuring their products
                comply with all applicable federal, state, and local food safety laws, regulations,
                and permit requirements (including cottage food laws, handlers' permits, and labeling
                requirements). By listing food for sale, producers accept full legal liability for the
                safety and legality of the food they sell.
              </p>
              <p>
                <strong>Buyers (consumers)</strong> are responsible for verifying the food safety,
                quality, and regulatory compliance of any produce or food products they purchase
                before consuming them.
              </p>
              <p>
                <strong>Community Garden</strong> is a peer-to-peer marketplace platform only. We do
                not inspect, certify, or guarantee the safety or legality of any listed products.
                Community Garden is not liable for any food safety issues, regulatory violations,
                illness, injury, or other harm arising from products sold or purchased through this
                platform.
              </p>
            </div>

            {/* Agree to terms */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('agreeToTerms')}
                className="mt-0.5 w-4 h-4 accent-garden-600 shrink-0"
              />
              <span className="text-sm text-gray-600">
                I have read and agree to the food safety notice above. I understand my legal
                responsibilities as a buyer and/or seller on this platform.
              </span>
            </label>
            {errors.agreeToTerms && (
              <p className="text-red-500 text-sm -mt-2">{errors.agreeToTerms.message}</p>
            )}

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
    </div>
  );
}
