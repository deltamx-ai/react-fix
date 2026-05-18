import { useAppNavigate } from '@/router'

export function ToQueryCase() {
  const navigate = useAppNavigate()

  return (
    <button
      onClick={() =>
        navigate({
          to: '/manage-policy?policyKey=P10001&epmRefNo=E20002',
        })
      }
    >
      go
    </button>
  )
}
