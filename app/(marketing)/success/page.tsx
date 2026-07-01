import { Suspense } from 'react'
import { TrendingUp } from 'lucide-react'
import SuccessInner from './SuccessInner'

function LoadingUI() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#3fb950]/20 flex items-center justify-center mx-auto">
          <TrendingUp className="w-6 h-6 text-[#3fb950]" />
        </div>
        <h1 className="text-2xl font-semibold text-[#e6edf3]">You&apos;re in.</h1>
        <p className="text-[#8b949e]">Setting up your account&hellip;</p>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<LoadingUI />}>
      <SuccessInner />
    </Suspense>
  )
}
