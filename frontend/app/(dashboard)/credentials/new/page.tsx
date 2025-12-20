'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import api from '@/lib/api';
import { Key, ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function NewCredentialPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const userOrganizationId = (session?.user as any)?.organizationId;
  const isAdmin = userRole === 'ADMIN';
  
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    apiKey: '',
    notes: '',
    tags: '',
    isPaid: false,
    hasAutopay: false,
    organizationId: '',
  });
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadOrganizations();
    }
  }, [isAdmin]);

  const loadOrganizations = async () => {
    try {
      const res = await api.get('/organizations');
      setOrganizations(res.data || []);
      // Set default to user's organization
      if (userOrganizationId && res.data) {
        const defaultOrg = res.data.find((org: any) => org.id === userOrganizationId);
        if (defaultOrg) {
          setFormData((prev) => ({ ...prev, organizationId: defaultOrg.id }));
        }
      }
    } catch (error: any) {
      console.error('Error loading organizations:', error);
      // Don't show error toast, just silently fail
    }
  };

  const templates = [
    {
      name: 'AWS Account',
      username: '',
      password: '',
      apiKey: '',
      notes: 'AWS Cloud Services Account',
      tags: 'aws,cloud,infrastructure',
    },
    {
      name: 'GitHub Repository',
      username: '',
      password: '',
      apiKey: '',
      notes: 'GitHub Personal Access Token',
      tags: 'github,development,version-control',
    },
    {
      name: 'Database Connection',
      username: '',
      password: '',
      apiKey: '',
      notes: 'Database credentials',
      tags: 'database,sql,backend',
    },
    {
      name: 'API Service',
      username: '',
      password: '',
      apiKey: '',
      notes: 'Third-party API credentials',
      tags: 'api,integration,external',
    },
  ];

  const applyTemplate = (template: typeof templates[0]) => {
    setFormData({
      name: template.name,
      username: template.username,
      password: template.password,
      apiKey: template.apiKey,
      notes: template.notes,
      tags: template.tags,
      isPaid: false,
      hasAutopay: false,
    });
    setShowTemplates(false);
    toast.success('Template applied! Please fill in the credentials.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tagsArray = formData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      await api.post('/credentials', {
        name: formData.name,
        username: formData.username,
        password: formData.password,
        apiKey: formData.apiKey || undefined,
        notes: formData.notes || undefined,
        tags: tagsArray,
        isPaid: formData.isPaid,
        hasAutopay: formData.hasAutopay,
        organizationId: isAdmin && formData.organizationId ? formData.organizationId : undefined,
      });

      toast.success('Credential created successfully');
      router.push('/credentials');
    } catch (error: any) {
      console.error('Error creating credential:', error);
      toast.error(error.response?.data?.message || 'Failed to create credential');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Link
          href="/credentials"
          className="text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Credential</h1>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Credential Details</h2>
          <button
            type="button"
            onClick={() => setShowTemplates(!showTemplates)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Use Template
          </button>
        </div>

        {showTemplates && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Templates</h3>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((template, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="text-left p-3 bg-white border border-gray-200 rounded-md hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900">{template.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{template.notes}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {isAdmin && organizations.length > 0 && (
            <div>
              <label htmlFor="organizationId" className="block text-sm font-medium text-gray-700 mb-2">
                Organization
              </label>
              <select
                id="organizationId"
                value={formData.organizationId}
                onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">Select Organization (defaults to your organization)</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.domain})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Select an organization for this credential. If not selected, it will be created in your organization.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="e.g., AWS Production Account"
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              id="username"
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Enter password"
            />
          </div>

          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
              API Key (Optional)
            </label>
            <input
              id="apiKey"
              type="text"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Enter API key if applicable"
            />
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
              Tags (comma-separated)
            </label>
            <input
              id="tags"
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="e.g., aws, production, cloud"
            />
            <p className="mt-1 text-xs text-gray-500">Separate multiple tags with commas</p>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Add any additional notes or context"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
              <input
                id="isPaid"
                type="checkbox"
                checked={formData.isPaid}
                onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isPaid" className="ml-2 block text-sm text-gray-700">
                Paid Tool
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="hasAutopay"
                type="checkbox"
                checked={formData.hasAutopay}
                onChange={(e) => setFormData({ ...formData, hasAutopay: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="hasAutopay" className="ml-2 block text-sm text-gray-700">
                Autopay Enabled
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 pt-4">
            <Link
              href="/credentials"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Credential'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
