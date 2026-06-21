import { type ChangeEvent } from "react"
import { classes } from "stylemap"
import { type EpisodeGenerationSettingsDraft, type ServerSettingsDraft } from "./types"
import { activeToggleThumbStyle, activeToggleTrackStyle, fieldGroupStyle, fieldsGridStyle, hiddenCheckboxStyle, hintStyle, inputStyle, labelStyle, panelContainerStyle, panelHeaderStyle, panelTitleStyle, toggleLabelStyle, toggleTextContainerStyle, toggleThumbStyle, toggleTrackStyle } from "./styles"

export function ServerPanel(props: {
    value: ServerSettingsDraft
    onChange: (field: keyof ServerSettingsDraft, value: string | boolean) => void
    episodeGenerationValue: EpisodeGenerationSettingsDraft
    onEpisodeGenerationChange: (field: keyof EpisodeGenerationSettingsDraft, value: string) => void
}) {
    return <div className={classes(panelContainerStyle)}>
        <div className={classes(panelHeaderStyle)}>
            <h3 className={classes(panelTitleStyle)}>Server Configuration</h3>
        </div>

        <div className={classes(fieldsGridStyle)}>
            <label className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>Address</span>
                <input
                    className={classes(inputStyle)}
                    type="text"
                    value={props.value.address}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange('address', event.target.value)}
                    placeholder="http://my-machine"
                />
                <span className={classes(hintStyle)}>Hostname or IP used in podcast and episode URLs. Optional http:// or https:// prefix. Defaults to http.</span>
            </label>

            <label className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>Port</span>
                <input
                    className={classes(inputStyle)}
                    type="number"
                    min="1"
                    max="65535"
                    value={props.value.port}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange('port', event.target.value)}
                    placeholder="80"
                />
            </label>

            <label className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>Password</span>
                <input
                    className={classes(inputStyle)}
                    type="password"
                    value={props.value.password}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange('password', event.target.value)}
                    placeholder={props.value.passwordConfigured ? '••••••••' : 'Set an access password'}
                    autoComplete="new-password"
                />
                <span className={classes(hintStyle)}>
                    {props.value.passwordConfigured ? 'Leave blank to keep existing password' : 'No password configured'}
                </span>
            </label>

            <label className={classes(toggleLabelStyle)}>
                <input
                    type="checkbox"
                    className={classes(hiddenCheckboxStyle)}
                    checked={props.value.listenOnAllInterfaces}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange('listenOnAllInterfaces', event.target.checked)}
                />
                <div className={classes([toggleTrackStyle, props.value.listenOnAllInterfaces && activeToggleTrackStyle])}>
                    <div className={classes([toggleThumbStyle, props.value.listenOnAllInterfaces && activeToggleThumbStyle])} />
                </div>
                <span className={classes(toggleTextContainerStyle)}>Listen on all interfaces</span>
            </label>
            <span className={classes(hintStyle)}>When off, the server only accepts connections to the address above</span>

            <span className={classes(hintStyle)}>Changing address, port, or listen mode will restart the server</span>

            <label className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>Concurrent episode generation</span>
                <input
                    className={classes(inputStyle)}
                    type="number"
                    min="1"
                    max="20"
                    value={props.episodeGenerationValue.concurrentGenerations}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onEpisodeGenerationChange('concurrentGenerations', event.target.value)}
                    placeholder="1"
                />
                <span className={classes(hintStyle)}>How many episodes can be generated at the same time.</span>
            </label>
        </div>
    </div>
}
