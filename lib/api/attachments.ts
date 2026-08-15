/**
 * Attachments API Service (JWT-based auth)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || "v2";

// Function to get JWT token - will be set by the store
let getToken: (() => string | null) | null = null;

export const setAttachmentSessionIdGetter = (getter: () => string | null) => {
  getToken = getter;
};

// Allowed file types for upload
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
export const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

export const isAllowedFileType = (file: File): boolean => {
  return ALLOWED_FILE_TYPES.includes(file.type);
};

export const attachmentsApi = {
  /**
   * Get attachment file URL
   */
  getFileUrl: (attachmentId: string): string => {
    return `${API_BASE_URL}/api/${API_VERSION}/attachments/file/${attachmentId}`;
  },

  /**
   * Fetch attachment as blob with authorization
   */
  getFile: async (attachmentId: string): Promise<Blob> => {
    const url = `${API_BASE_URL}/api/${API_VERSION}/attachments/file/${attachmentId}`;
    const token = getToken?.();
    
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch attachment');
    }
    return response.blob();
  },

  /**
   * Upload attachment to a ticket
   * @param ticketId - The ticket ID to attach the file to
   * @param file - The file to upload
   * @param options - Optional message and sendEmail flag
   */
  upload: async (
    ticketId: string,
    file: File,
    options?: { message?: string; sendEmail?: boolean }
  ): Promise<{ attachmentId: string }> => {
    const url = `${API_BASE_URL}/api/${API_VERSION}/attachments/${ticketId}`;
    const token = getToken?.();
    
    const headers: Record<string, string> = {
      "Content-Type": file.type || "application/octet-stream",
      "X-Filename": file.name,
    };
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    if (options?.message) {
      headers["X-Message"] = options.message;
    }
    
    if (options?.sendEmail) {
      headers["X-Send-Email"] = "true";
    }
    
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: file,
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to upload attachment' }));
      // Handle various error formats: { error: { message: "..." } }, { error: "..." }, { message: "..." }
      const errorMessage = 
        errorData.error?.message || 
        (typeof errorData.error === 'string' ? errorData.error : null) ||
        errorData.message || 
        'Failed to upload attachment';
      throw new Error(errorMessage);
    }
    
    return response.json();
  },

  /**
   * Upload multiple attachments to a ticket in one message
   * @param ticketId - The ticket ID to attach the files to
   * @param files - Array of files to upload
   * @param options - Optional message and sendEmail flag
   */
  uploadMultiple: async (
    ticketId: string,
    files: File[],
    options?: { message?: string; sendEmail?: boolean }
  ): Promise<{ attachmentIds: string[] }> => {
    const url = `${API_BASE_URL}/api/${API_VERSION}/attachments/${ticketId}/multiple`;
    const token = getToken?.();
    
    const formData = new FormData();
    // Use 'files' as field name (not 'files[]')
    files.forEach((file) => {
      formData.append('files', file);
    });
    
    // Add message and sendEmail to form data body
    if (options?.message) {
      formData.append('message', options.message);
    }
    
    if (options?.sendEmail) {
      formData.append('sendEmail', 'true');
    }
    
    const headers: Record<string, string> = {};
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to upload attachments' }));
      // Handle various error formats: { error: { message: "..." } }, { error: "..." }, { message: "..." }
      const errorMessage = 
        errorData.error?.message || 
        (typeof errorData.error === 'string' ? errorData.error : null) ||
        errorData.message || 
        'Failed to upload attachments';
      throw new Error(errorMessage);
    }
    
    return response.json();
  },
};
