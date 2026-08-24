export function useAuth() {
  const permissions = useState<string[]>('permissions', () => [])
  /** 受控動作可用性判定：權限點在清單內即為可用。 */
  function can(point: string): boolean {
    return permissions.value.includes(point)
  }
  return { can, permissions }
}
