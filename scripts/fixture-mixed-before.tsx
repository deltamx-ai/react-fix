import { useNavigate, useSearch, Link } from '@tanstack/react-router'

export function B() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  return (
    <>
      <Link to="/b">b</Link>
      <button onClick={() => navigate({ to: '/b', search })}>go</button>
    </>
  )
}
