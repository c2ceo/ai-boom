import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-20 pt-4 px-4 text-foreground max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Privacy Policy</h1>
      </div>

      <div className="prose prose-sm dark:prose-invert space-y-4 text-sm text-muted-foreground">
        <p><strong className="text-foreground">Last updated:</strong> March 12, 2026</p>

        <h2 className="text-foreground text-base font-semibold">1. Information We Collect</h2>
        <p>We collect information you provide directly: email address, username, display name, profile photo, and content you upload (images, videos, captions). We also collect usage data such as interactions, device information, and crash reports.</p>

        <h2 className="text-foreground text-base font-semibold">2. How We Use Your Information</h2>
        <p>We use your information to provide and improve AI-BOOM, personalize your feed, process payments, enforce our content policies, and communicate with you about your account.</p>

        <h2 className="text-foreground text-base font-semibold">3. Content Moderation</h2>
        <p>All uploaded content is automatically analyzed using AI to ensure compliance with our community guidelines. Explicit or harmful content is rejected and not stored.</p>

        <h2 className="text-foreground text-base font-semibold">4. Data Sharing</h2>
        <p>We do not sell your personal data. We share information only with service providers that help operate AI-BOOM (hosting, payment processing, content delivery) and when required by law.</p>

        <h2 className="text-foreground text-base font-semibold">5. Data Retention</h2>
        <p>We retain your data while your account is active. You can delete your account at any time from Settings, which permanently removes your profile, posts, and associated data.</p>

        <h2 className="text-foreground text-base font-semibold">6. Your Rights</h2>
        <p>You can access, update, or delete your personal data at any time through the app. You may also request a copy of your data by contacting us.</p>

        <h2 className="text-foreground text-base font-semibold">7. Children's Privacy</h2>
        <p>AI-BOOM is not intended for children under 13. We do not knowingly collect data from children under 13. Users must verify they are at least 13 years old to use the app.</p>

        <h2 className="text-foreground text-base font-semibold">8. Security</h2>
        <p>We implement industry-standard security measures including encryption, access controls, and regular security audits to protect your data.</p>

        <h2 className="text-foreground text-base font-semibold">9. Contact Us</h2>
        <p>For privacy inquiries, contact us at <a href="mailto:gregcampbellc2c@icloud.com" className="text-primary">gregcampbellc2c@icloud.com</a>.</p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
