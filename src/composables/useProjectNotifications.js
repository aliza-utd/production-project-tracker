import { createNotification } from '@/firebase-service'
import { useAuthStore } from '@/stores/auth'
import { useTeamStore } from '@/stores/team'

const STATUS_LABEL = {
  'not-started': 'Not Started',
  active: 'Active',
  blocked: 'Blocked',
  done: 'Done',
}

export function useProjectNotifications() {
  const authStore = useAuthStore()
  const teamStore = useTeamStore()

  // Returns team members who should receive a notification for a given project.
  // Admins and managers receive every notification regardless of assignment.
  // Other roles only receive notifications for projects they're assigned to.
  // NOTE: actor is NOT excluded here — managers need the full audit trail in
  // their own feed, and in a single-user setup the actor is the only recipient.
  function getNotifyTargets(assignedMembers) {
    const actorUid = authStore.currentUser?.uid
    console.log('[Notif] getNotifyTargets — actorUid:', actorUid, '| total teamMembers:', teamStore.teamMembers.length)

    const seen    = new Set()
    const targets = []

    for (const member of teamStore.teamMembers) {
      if (!member.uid) {
        console.log(`[Notif]   SKIP ${member.name} — no uid`)
        continue
      }
      if (!member.active) {
        console.log(`[Notif]   SKIP ${member.name} — inactive`)
        continue
      }
      if (seen.has(member.uid)) {
        console.log(`[Notif]   SKIP ${member.name} — already added`)
        continue
      }

      const isPrivileged = member.roleId === 'admin' || member.roleId === 'manager'
      const isAssigned   = (assignedMembers || []).some(am => am.id === member.id)

      if (isPrivileged || isAssigned) {
        seen.add(member.uid)
        targets.push(member)
        console.log(`[Notif]   ADD  ${member.name} (uid:${member.uid}) — privileged:${isPrivileged} assigned:${isAssigned}`)
      } else {
        console.log(`[Notif]   SKIP ${member.name} — not privileged and not assigned`)
      }
    }

    console.log('[Notif] getNotifyTargets result:', targets.map(t => t.name))
    return targets
  }

  function notifyPhaseStatus({ projectId, projectName, phaseName, fromStatus, toStatus, assignedMembers }) {
    const actor = authStore.currentUser
    console.log('[Notif] notifyPhaseStatus called — actor:', actor?.name, '| project:', projectName, '| phase:', phaseName, '| status:', fromStatus, '→', toStatus)

    if (!actor) { console.log('[Notif] ABORT — no actor (not logged in)'); return }
    if (!projectId) { console.log('[Notif] ABORT — no projectId'); return }

    const targets = getNotifyTargets(assignedMembers)
    if (!targets.length) {
      console.log('[Notif] ABORT — getNotifyTargets returned no targets')
      return
    }

    const statusLabel = STATUS_LABEL[toStatus] || toStatus
    const message     = `${actor.name} marked ${phaseName} as ${statusLabel} on "${projectName}"`
    console.log('[Notif] Writing phase_status notification for', targets.length, 'target(s):', targets.map(t => t.name))

    for (const target of targets) {
      console.log(`[Notif] → createNotification for ${target.name} (userId: ${target.uid})`)
      createNotification({
        userId:      target.uid,
        type:        'phase_status',
        message,
        projectId,
        projectName,
        phaseName,
        fromStatus,
        toStatus,
        read:        false,
      }).catch(err => console.error('[Notif] phase_status write failed for', target.name, ':', err))
    }
  }

  function notifyPhaseStarted({ projectId, projectName, phaseName, assignedMembers }) {
    const actor = authStore.currentUser
    console.log('[Notif] notifyPhaseStarted called — actor:', actor?.name, '| project:', projectName, '| phase:', phaseName)

    if (!actor) { console.log('[Notif] ABORT — no actor'); return }
    if (!projectId) { console.log('[Notif] ABORT — no projectId'); return }

    const targets = getNotifyTargets(assignedMembers)
    if (!targets.length) {
      console.log('[Notif] ABORT — no targets for notifyPhaseStarted')
      return
    }

    const message = `${phaseName} has started on "${projectName}"`
    console.log('[Notif] Writing phase_started notification for', targets.length, 'target(s)')

    for (const target of targets) {
      console.log(`[Notif] → createNotification for ${target.name} (userId: ${target.uid})`)
      createNotification({
        userId:      target.uid,
        type:        'phase_started',
        message,
        projectId,
        projectName,
        phaseName,
        read:        false,
      }).catch(err => console.error('[Notif] phase_started write failed for', target.name, ':', err))
    }
  }

  return { notifyPhaseStatus, notifyPhaseStarted }
}
