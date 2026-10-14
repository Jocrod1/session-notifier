package com.aoa.sessionnotifier

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertNotNull
import org.junit.Test

class ConnectionProtocolTest {
    @Test
    fun validatesNotificationFieldsAndLimits() {
        assertEquals(
            IncomingNotification("notification-1", "Session update", "Work finished"),
            validatedNotification("notification-1", "Session update", "Work finished"),
        )
        assertNull(validatedNotification("", "Session update", "Work finished"))
        assertNull(validatedNotification("invalid id", "Session update", "Work finished"))
        assertNull(validatedNotification("notification-1", "  ", "Work finished"))
        assertNull(validatedNotification("notification-1", "Session\u0000update", "Work finished"))
        assertNull(validatedNotification("notification-1", "t".repeat(121), "Work finished"))
        assertNull(validatedNotification("notification-1", "Session update", " "))
        assertNull(validatedNotification("notification-1", "Session update", "b".repeat(1_001)))
        assertNull(validatedNotification("notification-1", "Session update", "bad\u0000body"))
    }

    @Test
    fun mapsPermissionAndChannelAvailabilityToDistinctOutcomes() {
        assertEquals(
            NotificationPresentation.PERMISSION_DENIED,
            notificationAvailability(false, appNotificationsEnabled = true, channelEnabled = true),
        )
        assertEquals(
            NotificationPresentation.APP_NOTIFICATIONS_DISABLED,
            notificationAvailability(true, appNotificationsEnabled = false, channelEnabled = true),
        )
        assertEquals(
            NotificationPresentation.CHANNEL_DISABLED,
            notificationAvailability(true, appNotificationsEnabled = true, channelEnabled = false),
        )
        assertNull(notificationAvailability(true, appNotificationsEnabled = true, channelEnabled = true))
    }

    @Test
    fun repeatedIdentifiersRemainValidAndCanBeAcknowledgedIndependently() {
        assertNotNull(validatedNotification("repeated-id", "First", "First body"))
        assertNotNull(validatedNotification("repeated-id", "Second", "Second body"))
        assertEquals("channel-disabled", NotificationPresentation.CHANNEL_DISABLED.wireValue)
        assertEquals("failed", NotificationPresentation.FAILED.wireValue)
    }
}
