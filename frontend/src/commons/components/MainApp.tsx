import Header from '@/commons/components/Header'
import CredentialsSection from '@/features/credentials/CredentialsSection'
import SystemPromptSection from '@/features/generate/SystemPromptSection'
import TestCaseGenerator from '@/features/generate/TestCaseGenerator'

export default function MainApp() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <Header />

      <main className="space-y-6">
        <CredentialsSection />
        <SystemPromptSection />
        <TestCaseGenerator />
      </main>
    </div>
  )
}
