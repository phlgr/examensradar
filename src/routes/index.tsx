import { createFileRoute, Link } from '@tanstack/react-router'
import { Bell, Smartphone, Zap } from 'lucide-react'
import { Card, CardContent, LinkButton } from '@/components/ui'

export const Route = createFileRoute('/')({ component: LandingPage })

function LandingPage() {
  const steps = [
    {
      icon: <Bell className="w-8 h-8" />,
      title: '1. Anmelden',
      description: 'Erstelle ein Konto mit deinem Google-Account.',
      color: 'bg-nb-coral',
    },
    {
      icon: <Smartphone className="w-8 h-8" />,
      title: '2. ntfy einrichten',
      description: 'Installiere die ntfy App und abonniere deinen persönlichen Kanal.',
      color: 'bg-nb-teal',
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: '3. Benachrichtigt werden',
      description: 'Erhalte sofort eine Push-Nachricht, wenn neue Ergebnisse da sind.',
      color: 'bg-nb-yellow',
    },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="py-20 px-6 bg-nb-mint">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 md:p-12">
            <h1 className="text-5xl md:text-7xl font-black text-nb-black mb-6 uppercase leading-tight">
              Schluss mit<br />
              <span className="bg-nb-coral px-2 inline-block -rotate-1">F5-Drücken</span>
            </h1>
            <p className="text-xl md:text-2xl font-bold mb-8 max-w-2xl">
              Wir benachrichtigen dich sofort, wenn das Justizprüfungsamt neue
              Examensergebnisse veröffentlicht.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <LinkButton to="/auth/login" size="lg">
                Jetzt starten
              </LinkButton>
              <LinkButton to="/dashboard" variant="secondary" size="lg">
                Zum Dashboard
              </LinkButton>
            </div>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-nb-cream">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-center mb-16 uppercase">
            So funktioniert's
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, index) => (
              <Card key={index} hover>
                <CardContent className="p-6">
                  <div className={`w-16 h-16 ${step.color} border-4 border-nb-black flex items-center justify-center mb-4 shadow-[var(--nb-shadow-sm)]`}>
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-black uppercase mb-3">
                    {step.title}
                  </h3>
                  <p className="font-medium">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-nb-coral">
        <div className="max-w-3xl mx-auto">
          <Card variant="primary" className="p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-black uppercase mb-4">
              Bereit für stressfreies Warten?
            </h2>
            <p className="text-lg font-bold mb-8">
              Melde dich jetzt an und verpasse keine Ergebnisveröffentlichung mehr.
            </p>
            <LinkButton
              to="/auth/login"
              className="bg-nb-black text-nb-white shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] hover:shadow-none"
              size="lg"
            >
              Kostenlos starten
            </LinkButton>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-6 bg-nb-black text-nb-white border-t-4 border-nb-black">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <p className="font-bold">&copy; {new Date().getFullYear()} EXAMENSRADAR</p>
          <div className="flex gap-6 font-bold">
            <Link to="/impressum" className="hover:text-nb-yellow transition-colors uppercase">
              Impressum
            </Link>
            <Link to="/datenschutz" className="hover:text-nb-yellow transition-colors uppercase">
              Datenschutz
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
