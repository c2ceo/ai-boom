import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-20 pt-4 px-4 text-foreground max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Terms of Service</h1>
      </div>

      <div className="prose prose-sm dark:prose-invert space-y-4 text-sm text-muted-foreground">
        <p><strong className="text-foreground">Last updated:</strong> March 12, 2026</p>

        <h2 className="text-foreground text-base font-semibold">1. Acceptance of Terms</h2>
        <p>By using AI-BOOM, you agree to these Terms of Service. If you do not agree, do not use the app.</p>

        <h2 className="text-foreground text-base font-semibold">2. Eligibility</h2>
        <p>You must be at least 13 years old to create an account. Users under 18 should use the app with parental guidance and the Family Friendly filter enabled.</p>

        <h2 className="text-foreground text-base font-semibold">3. User Accounts</h2>
        <p>You are responsible for maintaining the security of your account. You must provide accurate information and keep your credentials secure.</p>

        <h2 className="text-foreground text-base font-semibold">4. Content Guidelines</h2>
        <p>You retain ownership of content you post. By posting, you grant AI-BOOM a non-exclusive license to display and distribute your content within the platform. Nudity, explicit content, harassment, and illegal content are strictly prohibited and will be removed.</p>

        <h2 className="text-foreground text-base font-semibold">5. AI-Generated Content</h2>
        <p>Content generated using AI-BOOM's tools is subject to the same guidelines. You are responsible for ensuring generated content complies with our policies.</p>

        <h2 className="text-foreground text-base font-semibold">6. In-App Purchases</h2>
        <p>Credits and subscriptions are non-refundable except as required by applicable law or the app store's refund policy. Prices may change with notice.</p>

        <h2 className="text-foreground text-base font-semibold">7. Termination</h2>
        <p>We may suspend or terminate accounts that violate these terms. You may delete your account at any time from Settings.</p>

        <h2 className="text-foreground text-base font-semibold">8. Disclaimers</h2>
        <p>AI-BOOM is provided "as is" without warranties. We are not liable for content posted by users or AI-generated outputs.</p>

        <h2 className="text-foreground text-base font-semibold">9. Changes to Terms</h2>
        <p>We may update these terms. Continued use after changes constitutes acceptance of the updated terms.</p>

        <h2 className="text-foreground text-base font-semibold">10. Contact</h2>
        <p>Questions? Email <a href="mailto:gregcampbellc2c@icloud.com" className="text-primary">gregcampbellc2c@icloud.com</a>.</p>
      </div>
    </div>
  );
};

export default TermsOfService;
