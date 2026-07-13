/* ===================================================================
   FORM HANDLERS — Submit contact and recipe suggestion forms to Supabase

   Usage:
   - Call FormHandlers.handleSuggestionSubmit(formElement) on form submit
   - Call FormHandlers.handleContactSubmit(formElement) on form submit
=================================================================== */

const FormHandlers = (() => {

  /**
   * Show success/error messages to user
   */
  function showMessage(element, message, isSuccess = true) {
    // Remove any existing message
    const existingMsg = element?.parentNode?.querySelector('.form-message');
    if (existingMsg) existingMsg.remove();

    // Create new message element
    const messageEl = document.createElement('div');
    messageEl.className = `form-message ${isSuccess ? 'success' : 'error'}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
      padding: 1rem;
      margin-top: 1rem;
      border-radius: 8px;
      font-weight: 500;
      animation: fadeIn 0.3s ease-out;
      ${isSuccess
        ? 'background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;'
        : 'background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;'
      }
    `;

    element?.parentNode?.insertBefore(messageEl, element?.nextSibling);

    // Auto-remove after 5 seconds
    setTimeout(() => messageEl.remove(), 5000);
  }

  /**
   * Handle "Suggest a Food" form submission
   * Form should have these input names: name, email, foodName, category, dietary, reason
   */
  async function handleSuggestionSubmit(formElement) {
    if (!formElement) {
      console.error('No form element provided');
      return;
    }

    // Prevent default form submission
    formElement.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Get form data
      const formData = new FormData(formElement);
      const data = {
        name: formData.get('name')?.trim(),
        email: formData.get('email')?.trim(),
        foodName: formData.get('foodName')?.trim(),
        category: formData.get('category')?.trim(),
        dietary: formData.get('dietary')?.trim(),
        reason: formData.get('reason')?.trim(),
      };

      // Validate required fields
      if (!data.name || !data.email || !data.foodName) {
        showMessage(formElement, '❌ Please fill in all required fields', false);
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        showMessage(formElement, '❌ Please enter a valid email address', false);
        return;
      }

      // Disable submit button to prevent double submission
      const submitBtn = formElement.querySelector('button[type="submit"]');
      const originalText = submitBtn?.textContent;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }

      // Submit to Supabase
      const result = await SupabaseClient.submitSuggestion(data);

      // Re-enable button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }

      if (result.success) {
        showMessage(formElement, '✓ Thank you! We\'ve received your suggestion. We\'ll get back to you soon!', true);
        formElement.reset(); // Clear form fields
      } else {
        showMessage(formElement, `❌ Error: ${result.error || 'Failed to submit suggestion'}`, false);
      }
    });
  }

  /**
   * Handle contact form submission
   * Form should have these input names: name, email, subject, message
   */
  async function handleContactSubmit(formElement) {
    if (!formElement) {
      console.error('No form element provided');
      return;
    }

    // Prevent default form submission
    formElement.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Get form data
      const formData = new FormData(formElement);
      const data = {
        name: formData.get('name')?.trim(),
        email: formData.get('email')?.trim(),
        subject: formData.get('subject')?.trim(),
        message: formData.get('message')?.trim(),
      };

      // Validate required fields
      if (!data.name || !data.email || !data.message) {
        showMessage(formElement, '❌ Please fill in all required fields', false);
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        showMessage(formElement, '❌ Please enter a valid email address', false);
        return;
      }

      // Disable submit button to prevent double submission
      const submitBtn = formElement.querySelector('button[type="submit"]');
      const originalText = submitBtn?.textContent;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
      }

      // Submit to Supabase
      const result = await SupabaseClient.submitContact(data);

      // Re-enable button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }

      if (result.success) {
        showMessage(formElement, '✓ Thank you for contacting us! We\'ll reply soon.', true);
        formElement.reset(); // Clear form fields
      } else {
        showMessage(formElement, `❌ Error: ${result.error || 'Failed to submit message'}`, false);
      }
    });
  }

  /**
   * Initialize all forms on page load
   * Automatically finds and sets up forms with data-form-type attribute
   */
  function initializeAllForms() {
    document.querySelectorAll('[data-form-type]').forEach(form => {
      const formType = form.dataset.formType;

      if (formType === 'suggestion') {
        handleSuggestionSubmit(form);
      } else if (formType === 'contact') {
        handleContactSubmit(form);
      }
    });
  }

  // Public API
  return {
    handleSuggestionSubmit,
    handleContactSubmit,
    initializeAllForms,
    showMessage,
  };
})();

// Auto-initialize forms when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  FormHandlers.initializeAllForms();
});
