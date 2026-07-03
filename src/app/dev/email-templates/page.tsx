import { getEmailTemplatePreviews } from '@/libs/better-auth/email-templates/utils/preview';

import { EmailTemplatePreviewPanel } from './EmailTemplatePreview';

export default function DevEmailTemplatesPage() {
  const templates = getEmailTemplatePreviews();

  return <EmailTemplatePreviewPanel templates={templates} />;
}
