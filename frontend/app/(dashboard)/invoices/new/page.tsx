'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import api from '@/lib/api';
import { FileText, ArrowLeft, Upload, Sparkles, Loader2, Key } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function NewInvoicePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const userOrganizationId = (session?.user as any)?.organizationId;
  const isAdmin = userRole === 'ADMIN';
  
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    amount: '',
    currency: 'USD', // Default to USD
    provider: '',
    billingDate: '',
    dueDate: '',
    category: '',
    organizationId: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [selectedCredentialIds, setSelectedCredentialIds] = useState<string[]>([]);

  useEffect(() => {
    loadCredentials();
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

  const loadCredentials = async () => {
    try {
      const res = await api.get('/credentials');
      setCredentials(res.data || []);
    } catch (error: any) {
      console.error('Error loading credentials:', error);
      // Don't show error toast, just silently fail - credentials are optional
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);

    if (selectedFile) {
      // Validate file type
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(selectedFile.type) && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Please upload a PDF or image file');
        return;
      }

      // Auto-detect invoice details
      setParsing(true);
      try {
        const formDataToSend = new FormData();
        formDataToSend.append('file', selectedFile);

        const response = await api.post('/invoices/parse', formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        // Check if response has error
        if (response.data?.error) {
          throw new Error(response.data.error);
        }

        const detectedData = response.data;

        // Auto-fill form fields with detected data
        if (detectedData) {
          // Ensure amount is a valid number
          let amountValue = '';
          if (detectedData.amount !== null && detectedData.amount !== undefined) {
            const numAmount = typeof detectedData.amount === 'number' 
              ? detectedData.amount 
              : parseFloat(String(detectedData.amount).replace(/[₹$€£¥,\s]/g, ''));
            if (!isNaN(numAmount) && isFinite(numAmount) && numAmount > 0) {
              amountValue = numAmount.toFixed(2);
            }
          }

          // Convert date format if needed (DD/MM/YYYY to YYYY-MM-DD)
          const convertDateForInput = (dateStr: string | undefined): string => {
            if (!dateStr) return '';
            
            // If already in YYYY-MM-DD format, return as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              return dateStr;
            }
            
            // If in DD/MM/YYYY format, convert to YYYY-MM-DD
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
              const [day, month, year] = dateStr.split('/');
              return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            
            // If in MM/DD/YYYY format, convert to YYYY-MM-DD
            if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
              const parts = dateStr.split('/');
              // Try both formats
              try {
                const date1 = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
                const date2 = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
                // Use the one that makes sense (month <= 12)
                if (parseInt(parts[0]) <= 12) {
                  return date1.toISOString().split('T')[0];
                } else {
                  return date2.toISOString().split('T')[0];
                }
              } catch {
                // Fallback
              }
            }
            
            // Try to parse as Date and format
            try {
              const date = new Date(dateStr);
              if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
              }
            } catch {
              // If parsing fails, return original
            }
            
            return dateStr;
          };

          // Update form data with detected values (only update if detected)
          const updatedData: any = {};
          
          if (detectedData.invoiceNumber) {
            updatedData.invoiceNumber = detectedData.invoiceNumber;
          }
          if (amountValue) {
            updatedData.amount = amountValue;
          }
          if (detectedData.provider) {
            updatedData.provider = detectedData.provider;
          }
          if (detectedData.billingDate) {
            const convertedBillingDate = convertDateForInput(detectedData.billingDate);
            if (convertedBillingDate) {
              updatedData.billingDate = convertedBillingDate;
            }
          }
          if (detectedData.dueDate) {
            const convertedDueDate = convertDateForInput(detectedData.dueDate);
            if (convertedDueDate) {
              updatedData.dueDate = convertedDueDate;
            }
          }
          if (detectedData.category) {
            updatedData.category = detectedData.category;
          }

          // Update form data
          setFormData((prev) => ({
            ...prev,
            ...updatedData,
            currency: 'USD', // Always use USD
          }));

          // Show success message with detected fields
          const detectedFields = Object.keys(updatedData).filter(key => updatedData[key]);
          if (detectedFields.length > 0) {
            setAutoFilled(true);
            toast.success(
              `Invoice details detected! Found: ${detectedFields.join(', ')}. Please review and update if needed.`,
              { duration: 5000 }
            );
          } else {
            toast('Could not detect invoice details from PDF. Please fill manually.', { 
              icon: 'ℹ️',
              duration: 4000 
            });
          }
        } else {
          toast('No data detected from invoice. Please fill manually.', { 
            icon: 'ℹ️',
            duration: 4000 
          });
        }
      } catch (error: any) {
        console.error('Error parsing invoice:', error);
        console.error('Error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });
        
        let errorMessage = 'Failed to parse invoice';
        if (error.response?.status === 404) {
          errorMessage = 'Parse endpoint not found. Please ensure the backend is running.';
        } else if (error.response?.status === 401) {
          errorMessage = 'Authentication required. Please log in again.';
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        toast.error(`Parsing failed: ${errorMessage}. Please fill details manually.`, {
          duration: 5000
        });
      } finally {
        setParsing(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.invoiceNumber || !formData.invoiceNumber.trim()) {
        toast.error('Invoice number is required');
        setLoading(false);
        return;
      }

      if (!formData.provider || !formData.provider.trim()) {
        toast.error('Provider is required');
        setLoading(false);
        return;
      }

      if (!formData.billingDate) {
        toast.error('Billing date is required');
        setLoading(false);
        return;
      }

      if (!formData.amount || formData.amount.trim() === '') {
        toast.error('Amount is required');
        setLoading(false);
        return;
      }

      // Validate and convert amount to number
      const amountValue = parseFloat(String(formData.amount).replace(/[₹$€£¥,\s]/g, ''));
      if (isNaN(amountValue) || !isFinite(amountValue) || amountValue <= 0) {
        toast.error('Please enter a valid amount greater than 0');
        setLoading(false);
        return;
      }

      // Convert date format if needed (handle DD/MM/YYYY to YYYY-MM-DD)
      const convertDate = (dateStr: string): string => {
        if (!dateStr) return '';
        
        // If already in YYYY-MM-DD format, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        
        // If in DD/MM/YYYY format, convert to YYYY-MM-DD
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
          const [day, month, year] = dateStr.split('/');
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        // Try to parse as Date and format
        try {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        } catch {
          // If parsing fails, return original
        }
        
        return dateStr;
      };

      const billingDate = convertDate(formData.billingDate);
      if (!billingDate || !/^\d{4}-\d{2}-\d{2}$/.test(billingDate)) {
        toast.error('Please enter a valid billing date');
        setLoading(false);
        return;
      }

      // Create FormData with all fields
      const formDataToSend = new FormData();
      formDataToSend.append('invoiceNumber', formData.invoiceNumber.trim());
      formDataToSend.append('amount', amountValue.toString());
      formDataToSend.append('currency', 'USD');
      formDataToSend.append('provider', formData.provider.trim());
      formDataToSend.append('billingDate', billingDate);
      
      if (formData.dueDate) {
        const dueDate = convertDate(formData.dueDate);
        if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
          formDataToSend.append('dueDate', dueDate);
        }
      }
      
      if (formData.category && formData.category.trim()) {
        formDataToSend.append('category', formData.category.trim());
      }
      
      // Add organization ID if admin selected one
      if (isAdmin && formData.organizationId) {
        formDataToSend.append('organizationId', formData.organizationId);
      }
      
      // Add credential IDs if selected
      if (selectedCredentialIds.length > 0) {
        // Backend expects credentialIds as an array
        selectedCredentialIds.forEach((credId) => {
          formDataToSend.append('credentialIds', credId);
        });
      }
      
      if (file) {
        formDataToSend.append('file', file);
      }

      // Send request
      const response = await api.post('/invoices', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 second timeout
      });

      toast.success('Invoice uploaded successfully!');
      
      // Small delay to show success message
      setTimeout(() => {
        router.push('/invoices');
      }, 500);
    } catch (error: any) {
      console.error('Error uploading invoice:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      
      let errorMessage = 'Failed to upload invoice';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Show specific validation errors
      if (error.response?.status === 400) {
        const validationErrors = error.response.data?.message || error.response.data;
        if (Array.isArray(validationErrors)) {
          errorMessage = validationErrors.map((err: any) => err.message || err).join(', ');
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Link
          href="/invoices"
          className="text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Upload New Invoice</h1>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 max-w-2xl">
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
                Select an organization for this invoice. If not selected, it will be created in your organization.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="invoiceNumber" className="block text-sm font-medium text-gray-700 mb-2">
              Invoice Number <span className="text-red-500">*</span>
              {autoFilled && formData.invoiceNumber && (
                <span className="ml-2 text-xs text-blue-600 font-normal">✓ Auto-detected</span>
              )}
            </label>
            <input
              id="invoiceNumber"
              type="text"
              required
              value={formData.invoiceNumber}
              onChange={(e) => {
                setFormData({ ...formData, invoiceNumber: e.target.value });
                setAutoFilled(false);
              }}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                autoFilled && formData.invoiceNumber ? 'bg-blue-50 border-blue-200' : ''
              }`}
              placeholder="e.g., INV-2024-001"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Amount <span className="text-red-500">*</span>
                {autoFilled && formData.amount && (
                  <span className="ml-2 text-xs text-blue-600 font-normal">✓ Auto-detected</span>
                )}
              </label>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formData.amount}
                onChange={(e) => {
                  const value = e.target.value;
                  // Only allow valid number input
                  if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                    setFormData({ ...formData, amount: value });
                    setAutoFilled(false);
                  }
                }}
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                  autoFilled && formData.amount ? 'bg-blue-50 border-blue-200' : ''
                }`}
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <input
                id="currency"
                type="text"
                value="USD ($) - US Dollar"
                disabled
                className="block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 text-gray-500 cursor-not-allowed sm:text-sm"
              />
              <input type="hidden" name="currency" value="USD" />
            </div>
          </div>

          <div>
            <label htmlFor="provider" className="block text-sm font-medium text-gray-700 mb-2">
              Provider/Vendor <span className="text-red-500">*</span>
              {autoFilled && formData.provider && (
                <span className="ml-2 text-xs text-blue-600 font-normal">✓ Auto-detected</span>
              )}
            </label>
            <input
              id="provider"
              type="text"
              required
              value={formData.provider}
              onChange={(e) => {
                setFormData({ ...formData, provider: e.target.value });
                setAutoFilled(false);
              }}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                autoFilled && formData.provider ? 'bg-green-50 border-green-200' : ''
              }`}
              placeholder="e.g., AWS, GitHub, Stripe"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="billingDate" className="block text-sm font-medium text-gray-700 mb-2">
                Billing Date <span className="text-red-500">*</span>
                {autoFilled && formData.billingDate && (
                  <span className="ml-2 text-xs text-blue-600 font-normal">✓ Auto-detected</span>
                )}
              </label>
              <input
                id="billingDate"
                type="date"
                required
                value={formData.billingDate}
                onChange={(e) => {
                  setFormData({ ...formData, billingDate: e.target.value });
                  setAutoFilled(false);
                }}
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                  autoFilled && formData.billingDate ? 'bg-blue-50 border-blue-200' : ''
                }`}
              />
            </div>
            <div>
              <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
                Due Date (Optional)
                {autoFilled && formData.dueDate && (
                  <span className="ml-2 text-xs text-blue-600 font-normal">✓ Auto-detected</span>
                )}
              </label>
              <input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => {
                  setFormData({ ...formData, dueDate: e.target.value });
                  setAutoFilled(false);
                }}
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                  autoFilled && formData.dueDate ? 'bg-blue-50 border-blue-200' : ''
                }`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category (Optional)
              {autoFilled && formData.category && (
                <span className="ml-2 text-xs text-blue-600 font-normal">✓ Auto-detected</span>
              )}
            </label>
            <input
              id="category"
              type="text"
              value={formData.category}
              onChange={(e) => {
                setFormData({ ...formData, category: e.target.value });
                setAutoFilled(false);
              }}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                autoFilled && formData.category ? 'bg-blue-50 border-blue-200' : ''
              }`}
              placeholder="e.g., Cloud Services, Software Licenses"
            />
          </div>

          <div>
            <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
              Invoice File (Optional)
              <span className="ml-2 text-xs text-blue-600 font-normal">
                {parsing ? 'Detecting details...' : autoFilled ? '✓ Details detected' : 'Auto-detect enabled'}
              </span>
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-blue-400 transition-colors">
              <div className="space-y-1 text-center">
                {parsing ? (
                  <>
                    <Loader2 className="mx-auto h-12 w-12 text-blue-600 animate-spin" />
                    <p className="text-sm text-gray-600 mt-2">Analyzing invoice...</p>
                  </>
                ) : (
                  <>
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="file"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                      >
                        <span>Upload a file</span>
                        <input
                          id="file"
                          name="file"
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="sr-only"
                          onChange={handleFileChange}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PDF, PNG, JPG up to 10MB</p>
                    {autoFilled && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-blue-600" />
                          <p className="text-xs text-blue-800 font-medium">Invoice details auto-detected!</p>
                        </div>
                      </div>
                    )}
                    {file && !parsing && (
                      <p className="text-sm text-gray-900 mt-2">{file.name}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 pt-4">
            <Link
              href="/invoices"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Uploading...' : 'Upload Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
