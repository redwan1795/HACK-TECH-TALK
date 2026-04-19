import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';

const schema = z.object({
  title: z.string().min(1, 'Title required').max(200),
  description: z.string().optional(),
  category: z.enum(['vegetable', 'fruit', 'flower', 'egg', 'other']),
  price_cents: z.string().optional(),
  quantity_available: z.string().min(1, 'Quantity required').refine((v) => !isNaN(Number(v)) && Number(v) >= 0, 'Must be a valid number'),
  location_zip: z.string().regex(/^\d{5}$/, 'Must be a 5-digit ZIP'),
  exchange_for: z.string().optional(),
  ready_to_deliver: z.boolean(),
  pickup_date: z.string().optional(),
  pickup_time: z.string().optional(),
  pickup_location: z.string().max(300).optional(),
}).superRefine((data, ctx) => {
  if (!data.ready_to_deliver) {
    if (!data.pickup_date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pickup_date'], message: 'Pickup date required' });
    }
    if (!data.pickup_time) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pickup_time'], message: 'Pickup time required' });
    }
    if (!data.pickup_location) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pickup_location'], message: 'Pickup location required' });
    }
  }
});

type FormData = z.infer<typeof schema>;

export default function CreateListingPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const onDrop = useCallback((accepted: File[]) => {
    const next = [...files, ...accepted].slice(0, 5);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, maxFiles: 5,
  });

  const {
    register, handleSubmit, watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ready_to_deliver: true },
  });

  const readyToDeliver = watch('ready_to_deliver') ?? true;

  const onSubmit = async (data: FormData) => {
    try {
      const priceCents = data.price_cents ? Math.round(parseFloat(data.price_cents) * 100) : undefined;
      const form = new globalThis.FormData();
      form.append('title', data.title);
      if (data.description) form.append('description', data.description);
      form.append('category', data.category);
      if (priceCents != null) form.append('price_cents', String(priceCents));
      form.append('quantity_available', data.quantity_available);
      form.append('location_zip', data.location_zip);
      if (data.exchange_for) form.append('exchange_for', data.exchange_for);
      form.append('ready_to_deliver', String(data.ready_to_deliver));
      if (!data.ready_to_deliver) {
        if (data.pickup_date) form.append('pickup_date', data.pickup_date);
        if (data.pickup_time) form.append('pickup_time', data.pickup_time);
        if (data.pickup_location) form.append('pickup_location', data.pickup_location);
      }
      files.forEach((f) => form.append('images', f));

      await apiClient.post('/listings', form);
      navigate('/producer/dashboard');
    } catch {
      setError('root', { message: 'Failed to create listing. Check all fields and try again.' });
    }
  };

  return (
    <div className="min-h-screen bg-garden-50 py-8">
      <div className="max-w-xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-garden-700 mb-6">New Listing</h1>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Photos (up to 5)</label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-garden-500 bg-garden-50' : 'border-gray-200 hover:border-garden-400'
              }`}
            >
              <input {...getInputProps()} />
              <p className="text-sm text-gray-400">
                {isDragActive ? 'Drop images here' : 'Drag & drop images, or click to select'}
              </p>
            </div>
            {previews.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {previews.map((p, i) => (
                  <img key={i} src={p} alt="" className="w-16 h-16 object-cover rounded-lg" />
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              id="title"
              {...register('title')}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-500"
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                {...register('category')}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-garden-500"
              >
                <option value="vegetable">Vegetable</option>
                <option value="fruit">Fruit</option>
                <option value="flower">Flower</option>
                <option value="egg">Egg</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price ($ per unit)</label>
              <input
                type="number" step="0.01" min="0"
                {...register('price_cents')}
                placeholder="Leave blank for exchange"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quantity_available" className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
              <input
                id="quantity_available"
                type="number" min="0"
                {...register('quantity_available')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-500"
              />
              {errors.quantity_available && (
                <p className="text-red-500 text-xs mt-1">{errors.quantity_available.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="location_zip" className="block text-sm font-medium text-gray-700 mb-1">ZIP code *</label>
              <input
                id="location_zip"
                {...register('location_zip')}
                maxLength={5}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-500"
              />
              {errors.location_zip && (
                <p className="text-red-500 text-xs mt-1">{errors.location_zip.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exchange for (optional)</label>
            <input
              {...register('exchange_for')}
              placeholder="e.g. tomato seedlings"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-500"
            />
          </div>

          {/* Delivery / Pickup toggle */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register('ready_to_deliver')}
                className="w-4 h-4 accent-garden-600"
              />
              <span className="text-sm font-medium text-gray-700">Ready to deliver</span>
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-7">
              {readyToDeliver
                ? 'You will deliver the order to the consumer\'s address.'
                : 'Consumer will pick up from you — fill in pickup details below.'}
            </p>

            {!readyToDeliver && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="pickup-date" className="block text-xs font-medium text-gray-700 mb-1">Pickup Date *</label>
                    <input
                      id="pickup-date"
                      type="date"
                      {...register('pickup_date')}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-500"
                    />
                    {errors.pickup_date && (
                      <p className="text-red-500 text-xs mt-1">{errors.pickup_date.message}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="pickup-time" className="block text-xs font-medium text-gray-700 mb-1">Pickup Time *</label>
                    <input
                      id="pickup-time"
                      type="time"
                      {...register('pickup_time')}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-500"
                    />
                    {errors.pickup_time && (
                      <p className="text-red-500 text-xs mt-1">{errors.pickup_time.message}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label htmlFor="pickup-location" className="block text-xs font-medium text-gray-700 mb-1">Pickup Location *</label>
                  <input
                    id="pickup-location"
                    {...register('pickup_location')}
                    placeholder="e.g. 123 Main St, front porch"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-500"
                  />
                  {errors.pickup_location && (
                    <p className="text-red-500 text-xs mt-1">{errors.pickup_location.message}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {errors.root && (
            <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{errors.root.message}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-garden-600 hover:bg-garden-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Creating…' : 'Create Listing'}
          </button>
        </form>
      </div>
    </div>
  );
}
