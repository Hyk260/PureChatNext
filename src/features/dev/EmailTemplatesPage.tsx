import { getEmailTemplatePreviews } from '@/libs/better-auth/email-templates/preview/server';

import { EmailTemplatePreviewPanel } from './EmailTemplatePreview';

export default function DevEmailTemplatesPage() {
  const templates = getEmailTemplatePreviews();

  return <EmailTemplatePreviewPanel templates={templates} />;
}
