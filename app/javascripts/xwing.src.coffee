###
    X-Wing Squad Builder
    Geordan Rosario <geordan@gmail.com>
    https://github.com/geordanr/xwing
###
exportObj = exports ? this

class exportObj.SquadBuilderBackend
    ###
        Usage:

            rebel_builder = new SquadBuilder
                faction: 'Rebel Alliance'
                ...
            empire_builder = new SquadBuilder
                faction: 'Galactic Empire'
                ...
            backend = new SquadBuilderBackend
                server: 'https://xwing.example.com'
                builders: [ rebel_builder, empire_builder ]
                login_logout_button: '#login-logout'
                auth_status: '#auth-status'

    ###
    constructor: (args) ->
        # Might as well do this right away
        $.ajaxSetup
            dataType: "json" # Because Firefox sucks for some reason
            xhrFields:
                withCredentials: true

        # args
        @server = args.server
        @builders = args.builders
        @login_logout_button = $ args.login_logout_button
        @auth_status = $ args.auth_status

        @authenticated = false
        @ui_ready = false
        @oauth_window = null

        @method_metadata =
            google_oauth2:
                icon: 'fa fa-google-plus-square'
                text: 'Google'
            facebook:
                icon: 'fa fa-facebook-square'
                text: 'Facebook'
            twitter:
                icon: 'fa fa-twitter-square'
                text: 'Twitter'

        @squad_display_mode = 'all'

        @collection_save_timer = null

        @setupHandlers()
        @setupUI()

        # Check initial authentication status
        @authenticate () =>
            @auth_status.hide()
            # @login_logout_button.removeClass 'hidden'

        # Finally, hook up the builders
        for builder in @builders
            builder.setBackend this

        @updateAuthenticationVisibility()

    updateAuthenticationVisibility: () ->
        if @authenticated
            $('.show-authenticated').show()
            $('.hide-authenticated').hide()
        else
            $('.show-authenticated').hide()
            $('.hide-authenticated').show()

    save: (serialized, id=null, name, faction, additional_data={}, cb) ->
        if serialized == ""
            cb
                id: null
                success: false
                error: "You cannot save an empty squad"
        else if $.trim(name) == ""
            cb
                id: null
                success: false
                error: "Squad name cannot be empty"
        else if not faction? or faction == ""
            throw "Faction unspecified to save()"
        else
            post_args =
                name: $.trim(name)
                faction: $.trim(faction)
                serialized: serialized
                additional_data: additional_data
            if id?
                post_url = "#{@server}/squads/#{id}"
            else
                post_url = "#{@server}/squads/new"
                post_args['_method'] = 'put'
            $.post post_url, post_args, (data, textStatus, jqXHR) =>
                cb
                    id: data.id
                    success: data.success
                    error: data.error

    delete: (id, cb) ->
        post_args =
            '_method': 'delete'
        $.post "#{@server}/squads/#{id}", post_args, (data, textStatus, jqXHR) =>
            cb
                success: data.success
                error: data.error

    list: (builder, all=false) ->
        # TODO: Pagination
        if all
            @squad_list_modal.find('.modal-header .squad-list-header-placeholder').text("Everyone's #{builder.faction} Squads")
        else
            @squad_list_modal.find('.modal-header .squad-list-header-placeholder').text("Your #{builder.faction} Squads")
        list_ul = $ @squad_list_modal.find('ul.squad-list')
        list_ul.text ''
        list_ul.hide()
        loading_pane = $ @squad_list_modal.find('p.squad-list-loading')
        loading_pane.show()
        @show_all_squads_button.click()
        @squad_list_modal.modal 'show'

        url = if all then "#{@server}/all" else "#{@server}/squads/list"
        $.get url, (data, textStatus, jqXHR) =>
            if data[builder.faction].length == 0
                list_ul.append $.trim """
                    <li>You have no squads saved.  Go save one!</li>
                """
            else
                for squad in data[builder.faction]
                    li = $ document.createElement('LI')
                    li.addClass 'squad-summary'
                    li.data 'squad', squad
                    li.data 'builder', builder
                    list_ul.append li
                    li.append $.trim """
                        <div class="row-fluid">
                            <div class="span9">
                                <h4>#{squad.name}</h4>
                            </div>
                            <div class="span3">
                                <h5>#{squad.additional_data.points} Points</h5>
                            </div>
                        </div>
                        <div class="row-fluid squad-description">
                            <div class="span8">
                                #{squad.additional_data.description}
                            </div>
                            <div class="span4">
                                <button class="btn load-squad">Load</button>
                                &nbsp;
                                <button class="btn btn-danger delete-squad">Delete</button>
                            </div>
                        </div>
                        <div class="row-fluid squad-delete-confirm">
                            <div class="span8">
                                Really delete <em>#{squad.name}</em>?
                            </div>
                            <div class="span4">
                                <button class="btn btn-danger confirm-delete-squad">Delete</button>
                                &nbsp;
                                <button class="btn cancel-delete-squad">Cancel</button>
                            </div>
                        </div>
                    """
                    li.find('.squad-delete-confirm').hide()

                    li.find('button.load-squad').click (e) =>
                        e.preventDefault()
                        button = $ e.target
                        li = button.closest 'li'
                        builder = li.data('builder')
                        @squad_list_modal.modal 'hide'
                        if builder.current_squad.dirty
                            @warnUnsaved builder, () ->
                                builder.container.trigger 'xwing-backend:squadLoadRequested', li.data('squad')
                        else
                            builder.container.trigger 'xwing-backend:squadLoadRequested', li.data('squad')

                    li.find('button.delete-squad').click (e) ->
                        e.preventDefault()
                        button = $ e.target
                        li = button.closest 'li'
                        builder = li.data('builder')
                        do (li) ->
                            li.find('.squad-description').fadeOut 'fast', ->
                                li.find('.squad-delete-confirm').fadeIn 'fast'

                    li.find('button.cancel-delete-squad').click (e) ->
                        e.preventDefault()
                        button = $ e.target
                        li = button.closest 'li'
                        builder = li.data('builder')
                        do (li) ->
                            li.find('.squad-delete-confirm').fadeOut 'fast', ->
                                li.find('.squad-description').fadeIn 'fast'

                    li.find('button.confirm-delete-squad').click (e) =>
                        e.preventDefault()
                        button = $ e.target
                        li = button.closest 'li'
                        builder = li.data('builder')
                        li.find('.cancel-delete-squad').fadeOut 'fast'
                        li.find('.confirm-delete-squad').addClass 'disabled'
                        li.find('.confirm-delete-squad').text 'Deleting...'
                        @delete li.data('squad').id, (results) ->
                            if results.success
                                li.slideUp 'fast', ->
                                    $(li).remove()
                            else
                                li.html $.trim """
                                    Error deleting #{li.data('squad').name}: <em>#{results.error}</em>
                                """

            loading_pane.fadeOut 'fast'
            list_ul.fadeIn 'fast'

    authenticate: (cb=$.noop) ->
        $(@auth_status.find('.payload')).text 'Checking auth status...'
        @auth_status.show()
        old_auth_state = @authenticated

        $.ajax
            url: "http://localhost/"
            success: (data) =>
        #         if data?.success
                    # @authenticated = true
                # else
                    @authenticated = false
                @maybeAuthenticationChanged old_auth_state, cb
            error: (jqXHR, textStatus, errorThrown) =>
                @authenticated = false
                @maybeAuthenticationChanged old_auth_state, cb

    maybeAuthenticationChanged: (old_auth_state, cb) =>
        if old_auth_state != @authenticated
            $(window).trigger 'xwing-backend:authenticationChanged', [ @authenticated, this ]
        @oauth_window = null
        @auth_status.hide()
        cb @authenticated
        @authenticated

    login: () ->
        # Display login dialog.
        if @ui_ready
            @login_modal.modal 'show'

    logout: (cb=$.noop) ->
        $(@auth_status.find('.payload')).text 'Logging out...'
        @auth_status.show()
        $.get "#{@server}/auth/logout", (data, textStatus, jqXHR) =>
            @authenticated = false
            $(window).trigger 'xwing-backend:authenticationChanged', [ @authenticated, this ]
            @auth_status.hide()
            cb()

    showSaveAsModal: (builder) ->
        @save_as_modal.data 'builder', builder
        @save_as_input.val builder.current_squad.name
        @save_as_save_button.addClass 'disabled'
        @nameCheck()
        @save_as_modal.modal 'show'

    showDeleteModal: (builder) ->
        @delete_modal.data 'builder', builder
        @delete_name_container.text builder.current_squad.name
        @delete_modal.modal 'show'

    nameCheck: () =>
        window.clearInterval @save_as_modal.data('timer')
        # trivial check
        name = $.trim(@save_as_input.val())
        if name.length == 0
            @name_availability_container.text ''
            @name_availability_container.append $.trim """
                <i class="fa fa-thumbs-down"> A name is required
            """
        else
            $.post "#{@server}/squads/namecheck", { name: name }, (data) =>
                @name_availability_container.text ''
                if data.available
                    @name_availability_container.append $.trim """
                        <i class="fa fa-thumbs-up"> Name is available
                    """
                    @save_as_save_button.removeClass 'disabled'
                else
                    @name_availability_container.append $.trim """
                        <i class="fa fa-thumbs-down"> You already have a squad with that name
                    """
                    @save_as_save_button.addClass 'disabled'

    warnUnsaved: (builder, action) ->
        @unsaved_modal.data 'builder', builder
        @unsaved_modal.data 'callback', action
        @unsaved_modal.modal 'show'

    setupUI: () ->
        @auth_status.addClass 'disabled'
        @auth_status.click (e) =>
            false

        @login_modal = $ document.createElement('DIV')
        @login_modal.addClass 'modal hide fade hidden-print'
        $(document.body).append @login_modal
        @login_modal.append $.trim """
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                <h3>Log in with OAuth</h3>
            </div>
            <div class="modal-body">
                <p>
                    Select one of the OAuth providers below to log in and start saving squads.
                    <a class="login-help" href="#">What's this?</a>
                </p>
                <div class="well well-small oauth-explanation">
                    <p>
                        <a href="http://en.wikipedia.org/wiki/OAuth" target="_blank">OAuth</a> is an authorization system which lets you prove your identity at a web site without having to create a new account.  Instead, you tell some provider with whom you already have an account (e.g. Google or Facebook) to prove to this web site that you say who you are.  That way, the next time you visit, this site remembers that you're that user from Google.
                    </p>
                    <p>
                        The best part about this is that you don't have to come up with a new username and password to remember.  And don't worry, I'm not collecting any data from the providers about you.  I've tried to set the scope of data to be as small as possible, but some places send a bunch of data at minimum.  I throw it away.  All I look at is a unique identifier (usually some giant number).
                    </p>
                    <p>
                        For more information, check out this <a href="http://hueniverse.com/oauth/guide/intro/" target="_blank">introduction to OAuth</a>.
                    </p>
                    <button class="btn">Got it!</button>
                </div>
                <ul class="login-providers inline"></ul>
                <p>
                    This will open a new window to let you authenticate with the chosen provider.  You may have to allow pop ups for this site.  (Sorry.)
                </p>
                <p class="login-in-progress">
                    <em>OAuth login is in progress.  Please finish authorization at the specified provider using the window that was just created.</em>
                </p>
            </div>
            <div class="modal-footer">
                <button class="btn" data-dismiss="modal" aria-hidden="true">Close</button>
            </div>
        """
        oauth_explanation = $ @login_modal.find('.oauth-explanation')
        oauth_explanation.hide()
        @login_modal.find('.login-in-progress').hide()
        @login_modal.find('a.login-help').click (e) =>
            e.preventDefault()
            unless oauth_explanation.is ':visible'
                oauth_explanation.slideDown 'fast'
        oauth_explanation.find('button').click (e) =>
            e.preventDefault()
            oauth_explanation.slideUp 'fast'
        $.get "#{@server}/methods", (data, textStatus, jqXHR) =>
            methods_ul = $ @login_modal.find('ul.login-providers')
            for method in data.methods
                a = $ document.createElement('A')
                a.addClass 'btn btn-inverse'
                a.data 'url', "#{@server}/auth/#{method}"
                a.append """<i class="#{@method_metadata[method].icon}"></i>&nbsp;#{@method_metadata[method].text}"""
                a.click (e) =>
                    e.preventDefault()
                    methods_ul.slideUp 'fast'
                    @login_modal.find('.login-in-progress').slideDown 'fast'
                    @oauth_window = window.open $(e.target).data('url'), "xwing_login"
                li = $ document.createElement('LI')
                li.append a
                methods_ul.append li
            @ui_ready = true

        @squad_list_modal = $ document.createElement('DIV')
        @squad_list_modal.addClass 'modal hide fade hidden-print squad-list'
        $(document.body).append @squad_list_modal
        @squad_list_modal.append $.trim """
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                <h3 class="squad-list-header-placeholder hidden-phone hidden-tablet"></h3>
                <h4 class="squad-list-header-placeholder hidden-desktop"></h4>
            </div>
            <div class="modal-body">
                <ul class="squad-list"></ul>
                <p class="pagination-centered squad-list-loading">
                    <i class="fa fa-spinner fa-spin fa-3x"></i>
                    <br />
                    Fetching squads...
                </p>
            </div>
            <div class="modal-footer">
                <div class="btn-group squad-display-mode">
                    <button class="btn btn-inverse show-all-squads">All</button>
                    <button class="btn show-standard-squads">Standard</button>
                    <button class="btn show-epic-squads">Epic</button>
                    <button class="btn show-team-epic-squads">Team<span class="hidden-phone"> Epic</span></button>
                </div>
                <button class="btn" data-dismiss="modal" aria-hidden="true">Close</button>
            </div>
        """
        @squad_list_modal.find('ul.squad-list').hide()

        @show_all_squads_button = $ @squad_list_modal.find('.show-all-squads')
        @show_all_squads_button.click (e) =>
            unless @squad_display_mode == 'all'
                @squad_display_mode = 'all'
                @squad_list_modal.find('.squad-display-mode .btn').removeClass 'btn-inverse'
                @show_all_squads_button.addClass 'btn-inverse'
                @squad_list_modal.find('.squad-list li').show()

        @show_standard_squads_button = $ @squad_list_modal.find('.show-standard-squads')
        @show_standard_squads_button.click (e) =>
            unless @squad_display_mode == 'standard'
                @squad_display_mode = 'standard'
                @squad_list_modal.find('.squad-display-mode .btn').removeClass 'btn-inverse'
                @show_standard_squads_button.addClass 'btn-inverse'
                @squad_list_modal.find('.squad-list li').each (idx, elem) ->
                    $(elem).toggle (($(elem).data().squad.serialized.search(/v\d+!e/) == -1) and ($(elem).data().squad.serialized.search(/v\d+!t/) == -1))

        @show_epic_squads_button = $ @squad_list_modal.find('.show-epic-squads')
        @show_epic_squads_button.click (e) =>
            unless @squad_display_mode == 'epic'
                @squad_display_mode = 'epic'
                @squad_list_modal.find('.squad-display-mode .btn').removeClass 'btn-inverse'
                @show_epic_squads_button.addClass 'btn-inverse'
                @squad_list_modal.find('.squad-list li').each (idx, elem) ->
                    $(elem).toggle $(elem).data().squad.serialized.search(/v\d+!e/) != -1

        @show_team_epic_squads_button = $ @squad_list_modal.find('.show-team-epic-squads')
        @show_team_epic_squads_button.click (e) =>
            unless @squad_display_mode == 'team-epic'
                @squad_display_mode = 'team-epic'
                @squad_list_modal.find('.squad-display-mode .btn').removeClass 'btn-inverse'
                @show_team_epic_squads_button.addClass 'btn-inverse'
                @squad_list_modal.find('.squad-list li').each (idx, elem) ->
                    $(elem).toggle $(elem).data().squad.serialized.search(/v\d+!t/) != -1

        @save_as_modal = $ document.createElement('DIV')
        @save_as_modal.addClass 'modal hide fade hidden-print'
        $(document.body).append @save_as_modal
        @save_as_modal.append $.trim """
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                <h3>Save Squad As...</h3>
            </div>
            <div class="modal-body">
                <label for="xw-be-squad-save-as">
                    New Squad Name
                    <input id="xw-be-squad-save-as"></input>
                </label>
                <span class="name-availability"></span>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary save" aria-hidden="true">Save</button>
                <button class="btn" data-dismiss="modal" aria-hidden="true">Close</button>
            </div>
        """
        @save_as_modal.on 'shown', () =>
            # Because Firefox handles this badly
            window.setTimeout () =>
                @save_as_input.focus()
                @save_as_input.select()
            , 100

        @save_as_save_button = @save_as_modal.find('button.save')
        @save_as_save_button.click (e) =>
            e.preventDefault()
            unless @save_as_save_button.hasClass('disabled')
                timer = @save_as_modal.data('timer')
                window.clearInterval(timer) if timer?
                @save_as_modal.modal 'hide'
                builder = @save_as_modal.data 'builder'
                additional_data =
                    points: builder.total_points
                    description: builder.describeSquad()
                    cards: builder.listCards()
                    notes: builder.getNotes()
                    obstacles: builder.getObstacles()
                builder.backend_save_list_as_button.addClass 'disabled'
                builder.backend_status.html $.trim """
                    <i class="fa fa-refresh fa-spin"></i>&nbsp;Saving squad...
                """
                builder.backend_status.show()
                new_name = $.trim @save_as_input.val()
                @save builder.serialize(), null, new_name, builder.faction, additional_data, (results) =>
                    if results.success
                        builder.current_squad.id = results.id
                        builder.current_squad.name = new_name
                        builder.current_squad.dirty = false
                        builder.container.trigger 'xwing-backend:squadDirtinessChanged'
                        builder.container.trigger 'xwing-backend:squadNameChanged'
                        builder.backend_status.html $.trim """
                            <i class="fa fa-check"></i>&nbsp;New squad saved successfully.
                        """
                    else
                        builder.backend_status.html $.trim """
                            <i class="fa fa-exclamation-circle"></i>&nbsp;#{results.error}
                        """
                    builder.backend_save_list_as_button.removeClass 'disabled'

        @save_as_input = $ @save_as_modal.find('input')
        @save_as_input.keypress (e) =>
            if e.which == 13
                @save_as_save_button.click()
                false
            else
                @name_availability_container.text ''
                @name_availability_container.append $.trim """
                    <i class="fa fa-spin fa-spinner"></i> Checking name availability...
                """
                timer = @save_as_modal.data('timer')
                window.clearInterval(timer) if timer?
                @save_as_modal.data 'timer', window.setInterval(@nameCheck, 500)

        @name_availability_container = $ @save_as_modal.find('.name-availability')

        @delete_modal = $ document.createElement('DIV')
        @delete_modal.addClass 'modal hide fade hidden-print'
        $(document.body).append @delete_modal
        @delete_modal.append $.trim """
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                <h3>Really Delete <span class="squad-name-placeholder"></span>?</h3>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete this squad?</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-danger delete" aria-hidden="true">Yes, Delete <i class="squad-name-placeholder"></i></button>
                <button class="btn" data-dismiss="modal" aria-hidden="true">Never Mind</button>
            </div>
        """

        @delete_name_container = $ @delete_modal.find('.squad-name-placeholder')
        @delete_button = $ @delete_modal.find('button.delete')
        @delete_button.click (e) =>
            e.preventDefault()
            builder = @delete_modal.data 'builder'
            builder.backend_status.html $.trim """
                <i class="fa fa-refresh fa-spin"></i>&nbsp;Deleting squad...
            """
            builder.backend_status.show()
            builder.backend_delete_list_button.addClass 'disabled'
            @delete_modal.modal 'hide'
            @delete builder.current_squad.id, (results) =>
                if results.success
                    builder.resetCurrentSquad()
                    builder.current_squad.dirty = true
                    builder.container.trigger 'xwing-backend:squadDirtinessChanged'
                    builder.backend_status.html $.trim """
                        <i class="fa fa-check"></i>&nbsp;Squad deleted.
                    """
                else
                    builder.backend_status.html $.trim """
                        <i class="fa fa-exclamation-circle"></i>&nbsp;#{results.error}
                    """
                    # Failed, so offer chance to delete again
                    builder.backend_delete_list_button.removeClass 'disabled'

        @unsaved_modal = $ document.createElement('DIV')
        @unsaved_modal.addClass 'modal hide fade hidden-print'
        $(document.body).append @unsaved_modal
        @unsaved_modal.append $.trim """
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                <h3>Unsaved Changes</h3>
            </div>
            <div class="modal-body">
                <p>You have not saved changes to this squad.  Do you want to go back and save?</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" aria-hidden="true" data-dismiss="modal">Go Back</button>
                <button class="btn btn-danger discard" aria-hidden="true">Discard Changes</button>
            </div>
        """
        @unsaved_discard_button = $ @unsaved_modal.find('button.discard')
        @unsaved_discard_button.click (e) =>
            e.preventDefault()
            @unsaved_modal.data('builder').current_squad.dirty = false
            @unsaved_modal.data('callback')()
            @unsaved_modal.modal 'hide'

    setupHandlers: () ->
        $(window).on 'xwing-backend:authenticationChanged', (e, authenticated, backend) =>
            @updateAuthenticationVisibility()
            if authenticated
                @loadCollection()

        @login_logout_button.click (e) =>
            e.preventDefault()
            if @authenticated
                @logout()
            else
                @login()

        $(window).on 'message', (e) =>
            ev = e.originalEvent
            if ev.origin == @server
                switch ev.data?.command
                    when 'auth_successful'
                        @authenticate()
                        @login_modal.modal 'hide'
                        @login_modal.find('.login-in-progress').hide()
                        @login_modal.find('ul.login-providers').show()
                        ev.source.close()
                    else
                        console.log "Unexpected command #{ev.data?.command}"
            else
                console.log "Message received from unapproved origin #{ev.origin}"
                window.last_ev = e
        .on 'xwing-collection:changed', (e, collection) =>
            clearTimeout(@collection_save_timer) if @collection_save_timer?
            @collection_save_timer = setTimeout =>
                @saveCollection collection, (res) ->
                    if res
                        $(window).trigger 'xwing-collection:saved', collection
            , 1000

    getSettings: (cb=$.noop) ->
        $.get("#{@server}/settings").done (data, textStatus, jqXHR) =>
            cb data.settings

    set: (setting, value, cb=$.noop) ->
        post_args =
            "_method": "PUT"
        post_args[setting] = value
        $.post("#{@server}/settings", post_args).done (data, textStatus, jqXHR) =>
            cb data.set

    deleteSetting: (setting, cb=$.noop) ->
        $.post("#{@server}/settings/#{setting}", {"_method": "DELETE"}).done (data, textStatus, jqXHR) =>
            cb data.deleted

    getHeaders: (cb=$.noop) ->
        $.get("#{@server}/headers").done (data, textStatus, jqXHR) =>
            cb data.headers

    getLanguagePreference: (settings, cb=$.noop) =>
        # Check session, then headers
        if settings?.language?
            cb settings.language
        else
            await @getHeaders defer(headers)
            if headers?.HTTP_ACCEPT_LANGUAGE?
                # Need to parse out language preferences
                # I'm going to be lazy and only output the first one we encounter
                for language_range in headers.HTTP_ACCEPT_LANGUAGE.split(',')
                    [ language_tag, quality ] = language_range.split ';'
                    if language_tag == '*'
                        cb 'English'
                    else
                        language_code = language_tag.split('-')[0]
                        cb(exportObj.codeToLanguage[language_code] ? 'English')
                    break
            else
                cb 'English'

    saveCollection: (collection, cb=$.noop) ->
        post_args =
            expansions: collection.expansions
            singletons: collection.singletons
        $.post("#{@server}/collection", post_args).done (data, textStatus, jqXHR) ->
            cb data.success

    loadCollection: ->
        # Backend provides an empty collection if none exists yet for the user.
        $.get("#{@server}/collection").done (data, textStatus, jqXHR) ->
            collection = data.collection
            new exportObj.Collection
                expansions: collection.expansions
                singletons: collection.singletons

###
    X-Wing Card Browser
    Geordan Rosario <geordan@gmail.com>
    https://github.com/geordanr/xwing
###
exportObj = exports ? this

# Assumes cards.js has been loaded

TYPES = [ 'pilots', 'upgrades', 'modifications', 'titles' ]

byName = (a, b) ->
    a_name = a.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '')
    b_name = b.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '')
    if a_name < b_name
        -1
    else if b_name < a_name
        1
    else
        0

byPoints = (a, b) ->
    if a.data.points < b.data.points
        -1
    else if b.data.points < a.data.points
        1
    else
        byName a, b

String::capitalize = ->
    this.charAt(0).toUpperCase() + this.slice(1)

class exportObj.CardBrowser
    constructor: (args) ->
        # args
        @container = $ args.container

        # internals
        @currently_selected = null
        @language = 'English'

        @prepareData()

        @setupUI()
        @setupHandlers()

        @sort_selector.change()

    setupUI: () ->
        @container.append $.trim """
            <div class="container-fluid xwing-card-browser">
                <div class="row-fluid">
                    <div class="span12">
                        <span class="translate sort-cards-by">Sort cards by</span>: <select class="sort-by">
                            <option value="name">Name</option>
                            <option value="source">Source</option>
                            <option value="type-by-points">Type (by Points)</option>
                            <option value="type-by-name" selected="1">Type (by Name)</option>
                        </select>
                    </div>
                </div>
                <div class="row-fluid">
                    <div class="span4 card-selector-container">

                    </div>
                    <div class="span8">
                        <div class="well card-viewer-placeholder info-well">
                            <p class="translate select-a-card">Select a card from the list at the left.</p>
                        </div>
                        <div class="well card-viewer-container info-well">
                            <span class="info-name"></span>
                            <br />
                            <span class="info-type"></span>
                            <br />
                            <span class="info-sources"></span>
                            <table>
                                <tbody>
                                    <tr class="info-skill">
                                        <td class="info-header">Skill</td>
                                        <td class="info-data info-skill"></td>
                                    </tr>
                                    <tr class="info-energy">
                                        <td class="info-header"><i class="xwing-miniatures-font xwing-miniatures-font-energy"></i></td>
                                        <td class="info-data info-energy"></td>
                                    </tr>
                                    <tr class="info-attack">
                                        <td class="info-header"><i class="xwing-miniatures-font xwing-miniatures-font-attack"></i></td>
                                        <td class="info-data info-attack"></td>
                                    </tr>
                                    <tr class="info-range">
                                        <td class="info-header">Range</td>
                                        <td class="info-data info-range"></td>
                                    </tr>
                                    <tr class="info-agility">
                                        <td class="info-header"><i class="xwing-miniatures-font xwing-miniatures-font-agility"></i></td>
                                        <td class="info-data info-agility"></td>
                                    </tr>
                                    <tr class="info-hull">
                                        <td class="info-header"><i class="xwing-miniatures-font xwing-miniatures-font-hull"></i></td>
                                        <td class="info-data info-hull"></td>
                                    </tr>
                                    <tr class="info-shields">
                                        <td class="info-header"><i class="xwing-miniatures-font xwing-miniatures-font-shield"></i></td>
                                        <td class="info-data info-shields"></td>
                                    </tr>
                                    <tr class="info-actions">
                                        <td class="info-header">Actions</td>
                                        <td class="info-data"></td>
                                    </tr>
                                    <tr class="info-upgrades">
                                        <td class="info-header">Upgrades</td>
                                        <td class="info-data"></td>
                                    </tr>
                                </tbody>
                            </table>
                            <p class="info-text" />
                        </div>
                    </div>
                </div>
            </div>
        """

        @card_selector_container = $ @container.find('.xwing-card-browser .card-selector-container')
        @card_viewer_container = $ @container.find('.xwing-card-browser .card-viewer-container')
        @card_viewer_container.hide()
        @card_viewer_placeholder = $ @container.find('.xwing-card-browser .card-viewer-placeholder')

        @sort_selector = $ @container.find('select.sort-by')
        @sort_selector.select2
            minimumResultsForSearch: -1

    setupHandlers: () ->
        @sort_selector.change (e) =>
            @renderList @sort_selector.val()

        $(window).on 'xwing:afterLanguageLoad', (e, language, cb=$.noop) =>
            @language = language
            @prepareData()
            @renderList @sort_selector.val()

    prepareData: () ->
        @all_cards = []

        for type in TYPES
            if type == 'upgrades'
                @all_cards = @all_cards.concat ( { name: card_data.name, type: exportObj.translate(@language, 'ui', 'upgradeHeader', card_data.slot), data: card_data, orig_type: card_data.slot } for card_name, card_data of exportObj[type] )
            else
                @all_cards = @all_cards.concat ( { name: card_data.name, type: exportObj.translate(@language, 'singular', type), data: card_data, orig_type: exportObj.translate('English', 'singular', type) } for card_name, card_data of exportObj[type] )

        @types = (exportObj.translate(@language, 'types', type) for type in [ 'Pilot', 'Modification', 'Title' ])
        for card_name, card_data of exportObj.upgrades
            upgrade_text = exportObj.translate @language, 'ui', 'upgradeHeader', card_data.slot
            @types.push upgrade_text if upgrade_text not in @types

        @all_cards.sort byName

        @sources = []
        for card in @all_cards
            for source in card.data.sources
                @sources.push(source) if source not in @sources

        sorted_types = @types.sort()
        sorted_sources = @sources.sort()

        @cards_by_type_name = {}
        for type in sorted_types
            @cards_by_type_name[type] = ( card for card in @all_cards when card.type == type ).sort byName

        @cards_by_type_points = {}
        for type in sorted_types
            @cards_by_type_points[type] = ( card for card in @all_cards when card.type == type ).sort byPoints

        @cards_by_source = {}
        for source in sorted_sources
            @cards_by_source[source] = ( card for card in @all_cards when source in card.data.sources ).sort byName


    renderList: (sort_by='name') ->
        # sort_by is one of `name`, `type-by-name`, `source`, `type-by-points`
        #
        # Renders multiselect to container
        # Selects previously selected card if there is one
        @card_selector.remove() if @card_selector?
        @card_selector = $ document.createElement('SELECT')
        @card_selector.addClass 'card-selector'
        @card_selector.attr 'size', 25
        @card_selector_container.append @card_selector

        switch sort_by
            when 'type-by-name'
                for type in @types
                    optgroup = $ document.createElement('OPTGROUP')
                    optgroup.attr 'label', type
                    @card_selector.append optgroup

                    for card in @cards_by_type_name[type]
                        @addCardTo optgroup, card
            when 'type-by-points'
                for type in @types
                    optgroup = $ document.createElement('OPTGROUP')
                    optgroup.attr 'label', type
                    @card_selector.append optgroup

                    for card in @cards_by_type_points[type]
                        @addCardTo optgroup, card
            when 'source'
                for source in @sources
                    optgroup = $ document.createElement('OPTGROUP')
                    optgroup.attr 'label', source
                    @card_selector.append optgroup

                    for card in @cards_by_source[source]
                        @addCardTo optgroup, card
            else
                for card in @all_cards
                    @addCardTo @card_selector, card

        @card_selector.change (e) =>
            @renderCard $(@card_selector.find(':selected'))

    renderCard: (card) ->
        # Renders card to card container
        name = card.data 'name'
        type = card.data 'type'
        data = card.data 'card'
        orig_type = card.data 'orig_type'

        @card_viewer_container.find('.info-name').html """#{if data.unique then "&middot;&nbsp;" else ""}#{name} (#{data.points})#{if data.limited? then " (#{exportObj.translate(@language, 'ui', 'limited')})" else ""}#{if data.epic? then " (#{exportObj.translate(@language, 'ui', 'epic')})" else ""}#{if exportObj.isReleased(data) then "" else " (#{exportObj.translate(@language, 'ui', 'unreleased')})"}"""
        @card_viewer_container.find('p.info-text').html data.text ? ''
        @card_viewer_container.find('.info-sources').text (exportObj.translate(@language, 'sources', source) for source in data.sources).sort().join(', ')
        switch orig_type
            when 'Pilot'
                ship = exportObj.ships[data.ship]
                @card_viewer_container.find('.info-type').text "#{data.ship} Pilot (#{data.faction})"
                @card_viewer_container.find('tr.info-skill td.info-data').text data.skill
                @card_viewer_container.find('tr.info-skill').show()
                @card_viewer_container.find('tr.info-attack td.info-data').text(data.ship_override?.attack ? ship.attack)
                @card_viewer_container.find('tr.info-attack').toggle(data.ship_override?.attack? or ship.attack?)

                for cls in @card_viewer_container.find('tr.info-attack td.info-header i.xwing-miniatures-font')[0].classList
                    @card_viewer_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').removeClass(cls) if cls.startsWith('xwing-miniatures-font-attack')
                @card_viewer_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').addClass(ship.attack_icon ? 'xwing-miniatures-font-attack')

                @card_viewer_container.find('tr.info-energy td.info-data').text(data.ship_override?.energy ? ship.energy)
                @card_viewer_container.find('tr.info-energy').toggle(data.ship_override?.energy? or ship.energy?)
                @card_viewer_container.find('tr.info-range').hide()
                @card_viewer_container.find('tr.info-agility td.info-data').text(data.ship_override?.agility ? ship.agility)
                @card_viewer_container.find('tr.info-agility').show()
                @card_viewer_container.find('tr.info-hull td.info-data').text(data.ship_override?.hull ? ship.hull)
                @card_viewer_container.find('tr.info-hull').show()
                @card_viewer_container.find('tr.info-shields td.info-data').text(data.ship_override?.shields ? ship.shields)
                @card_viewer_container.find('tr.info-shields').show()
                @card_viewer_container.find('tr.info-actions td.info-data').text (exportObj.translate(@language, 'action', action) for action in exportObj.ships[data.ship].actions).join(', ')
                @card_viewer_container.find('tr.info-actions').show()
                @card_viewer_container.find('tr.info-upgrades').show()
                @card_viewer_container.find('tr.info-upgrades td.info-data').text((exportObj.translate(@language, 'slot', slot) for slot in data.slots).join(', ') or 'None')
            else
                @card_viewer_container.find('.info-type').text type
                @card_viewer_container.find('.info-type').append " &ndash; #{data.faction} only" if data.faction?
                @card_viewer_container.find('tr.info-ship').hide()
                @card_viewer_container.find('tr.info-skill').hide()
                if data.energy?
                    @card_viewer_container.find('tr.info-energy td.info-data').text data.energy
                    @card_viewer_container.find('tr.info-energy').show()
                else
                    @card_viewer_container.find('tr.info-energy').hide()
                if data.attack?
                    @card_viewer_container.find('tr.info-attack td.info-data').text data.attack
                    @card_viewer_container.find('tr.info-attack').show()
                else
                    @card_viewer_container.find('tr.info-attack').hide()
                if data.range?
                    @card_viewer_container.find('tr.info-range td.info-data').text data.range
                    @card_viewer_container.find('tr.info-range').show()
                else
                    @card_viewer_container.find('tr.info-range').hide()
                @card_viewer_container.find('tr.info-agility').hide()
                @card_viewer_container.find('tr.info-hull').hide()
                @card_viewer_container.find('tr.info-shields').hide()
                @card_viewer_container.find('tr.info-actions').hide()
                @card_viewer_container.find('tr.info-upgrades').hide()

        @card_viewer_container.show()
        @card_viewer_placeholder.hide()

    addCardTo: (container, card) ->
        option = $ document.createElement('OPTION')
        option.text "#{card.name} (#{card.data.points})"
        option.data 'name', card.name
        option.data 'type', card.type
        option.data 'card', card.data
        option.data 'orig_type', card.orig_type
        $(container).append option

# This must be loaded before any of the card language modules!
exportObj = exports ? this

exportObj.unreleasedExpansions = [
    'Alpha-class Star Wing Expansion Pack',
    'M12-L Kimogila Fighter Expansion Pack',
    'Phantom II Expansion Pack',
    'Resistance Bomber Expansion Pack',
    'TIE Silencer Expansion Pack',
]

exportObj.isReleased = (data) ->
    for source in data.sources
        return true if source not in exportObj.unreleasedExpansions
    false

String::canonicalize = ->
    this.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/\s+/g, '-')

exportObj.hugeOnly = (ship) ->
    ship.data.huge ? false

# Returns an independent copy of the data which can be modified by translation
# modules.
exportObj.basicCardData = ->
    ships:
        "X-Wing":
            name: "X-Wing"
            factions: [ "Rebel Alliance", ]
            attack: 3
            agility: 2
            hull: 3
            shields: 2
            actions: [
                "Focus"
                "Target Lock"
            ]
            maneuvers: [
              [ 0, 0, 0, 0, 0, 0]
              [ 0, 2, 2, 2, 0, 0]
              [ 1, 1, 2, 1, 1, 0]
              [ 1, 1, 1, 1, 1, 0]
              [ 0, 0, 1, 0, 0, 3]
            ]
        "Y-Wing":
            name: "Y-Wing"
            factions: [ "Rebel Alliance", "Scum and Villainy", ]
            attack: 2
            agility: 1
            hull: 5
            shields: 3
            actions: [
                "Focus"
                "Target Lock"
            ]
            maneuvers: [
              [ 0, 0, 0, 0, 0, 0]
              [ 0, 1, 2, 1, 0, 0]
              [ 1, 1, 2, 1, 1, 0]
              [ 3, 1, 1, 1, 3, 0]
              [ 0, 0, 3, 0, 0, 3]
            ]
        "A-Wing":
            name: "A-Wing"
            factions: [ "Rebel Alliance", ]
            attack: 2
            agility: 3
            hull: 2
            shields: 2
            actions: [
                "Focus"
                "Target Lock"
                "Boost"
                "Evade"
            ]
            maneuvers: [
              [ 0, 0, 0, 0, 0, 0]
              [ 1, 0, 0, 0, 1, 0]
              [ 2, 2, 2, 2, 2, 0]
              [ 1, 1, 2, 1, 1, 3]
              [ 0, 0, 2, 0, 0, 0]
              [ 0, 0, 2, 0, 0, 3]
            ]
        "YT-1300":
            name: "YT-1300"
            factions: [ "Rebel Alliance", "Resistance" ]
            attack: 2
            agility: 1
            hull: 6
            shields: 4
            actions: [
                "Focus"
                "Target Lock"
            ]
            attack_icon: 'xwing-miniatures-font-attack-turret'
            maneuvers: [
              [ 0, 0, 0, 0, 0, 0]
              [ 1, 2, 2, 2, 1, 0]
              [ 1, 1, 2, 1, 1, 0]
              [ 0, 1, 1, 1, 0, 3]
              [ 0, 0, 1, 0, 0, 3]
            ]
            large: true
        "TIE Fighter":
            name: "TIE Fighter"
            factions: ["Rebel Alliance", "Galactic Empire"]
            attack: 2
            agility: 3
            hull: 3
            shields: 0
            actions: [
                "Focus"
                "Barrel Roll"
                "Evade"
            ]
            maneuvers: [
              [ 0, 0, 0, 0, 0, 0]
              [ 1, 0, 0, 0, 1, 0]
              [ 1, 2, 2, 2, 1, 0]
              [ 1, 1, 2, 1, 1, 3]
              [ 0, 0, 1, 0, 0, 3]
              [ 0, 0, 1, 0, 0, 0]
            ]
        "TIE Advanced":
            name: "TIE Advanced"
            factions: [ "Galactic Empire", ]
            attack: 2
            agility: 3
            hull: 3
            shields: 2
            actions: [
                "Focus"
                "Target Lock"
                "Barrel Roll"
                "Evade"
            ]
            maneuvers: [
              [ 0, 0, 0, 0, 0, 0]
              [ 0, 2, 0, 2, 0, 0]
              [ 1, 1, 2, 1, 1, 0]
              [ 1, 1, 2, 1, 1, 0]
              [ 0, 0, 1, 0, 0, 3]
              [ 0, 0, 1, 0, 0, 0]
            ]
        "TIE Interceptor":
            name: "TIE Interceptor"
            factions: [ "Galactic Empire", ]
            attack: 3
            agility: 3
            hull: 3
            shields: 0
            actions: [
                "Focus"
                "Barrel Roll"
                "Boost"
                "Evade"
            ]
            maneuvers: [
              [ 0, 0, 0, 0, 0, 0]
              [ 1, 0, 0, 0, 1, 0]
              [ 2, 2, 2, 2, 2, 0]
              [ 1, 1, 2, 1, 1, 3]
              [ 0, 0, 2, 0, 0, 0]
              [ 0, 0, 1, 0, 0, 3]
            ]
        "Firespray-31":
            name: "Firespray-31"
            factions: [ "Galactic Empire", "Scum and Villainy", ]
            attack: 3
            agility: 2
            hull: 6
            shields: 4
            actions: [
                "Focus"
                "Target Lock"
                "Evade"
            ]
            attack_icon: 'xwing-miniatures-font-attack-frontback'
            maneuvers: [
              [ 0, 0, 0, 0, 0, 0]
              [ 0, 2, 2, 2, 0, 0]
              [ 1, 1, 2, 1, 1, 0]
              [ 1, 1, 1, 1, 1, 3]
              [ 0, 0, 1, 0, 0, 3]
            ]
            large: true
        "HWK-290":
            name: "HWK-290"
            factions: [ "Rebel Alliance", "Scum and Villainy", ]
            attack: 1
            agility: 2
            hull: 4
            shields: 1
            actions: [
                "Focus"
                "Target Lock"
            ]
            maneuvers: [
              [ 0, 0, 0, 0, 0]
              [ 0, 2, 2, 2, 0]
              [ 1, 1, 2, 1, 1]
              [ 0, 3, 1, 3, 0]
              [ 0, 0, 3, 0, 0]
            ]
        "Lambda-Class Shuttle":
            name: "Lambda-Class Shuttle"
            factions: [ "Galactic Empire", ]
            attack: 3
            agility: 1
            hull: 5
            shields: 5
            actions: [
                "Focus"
                "Target Lock"
            ]
            maneuvers: [
              [ 0, 0, 3, 0, 0]
              [ 0, 2, 2, 2, 0]
              [ 3, 1, 2, 1, 3]
              [ 0, 3, 1, 3, 0]
            ]
            large: true
        "B-Wing":
            name: "B-Wing"
            factions: [ "Rebel Alliance", ]
            attack: 3
            agility: 1
            hull: 3
            shields: 5
            actions: [
                "Focus"
                "Target Lock"
                "Barrel Roll"
            ]
            maneuvers: [
              [ 0, 0, 0, 0, 0, 0]
              [ 3, 2, 2, 2, 3, 0]
              [ 1, 1, 2, 1, 1, 3]
              [ 0, 3, 1, 3, 0, 0]
              [ 0, 0, 3, 0, 0, 0]
            ]
        "TIE Bomber":
            name: "TIE Bomber"
            factions: [ "Galactic Empire", ]
            attack: 2
            agility: 2
            hull: 6
            shields: 0
            actions: [
                "Focus"
                "Target Lock"
                "Barrel Roll"
            ]
            maneuvers: [
              [ 0, 0, 0, 0, 0, 0]
              [ 0, 1, 2, 1, 0, 0]
              [ 3, 2, 2, 2, 3, 0]
              [ 1, 1, 2, 1, 1, 0]
              [ 0, 0, 1, 0, 0, 0]
              [ 0, 0, 0, 0, 0, 3]
            ]
        "GR-75 Medium Transport":
            name: "GR-75 Medium Transport"
            factions: [ "Rebel Alliance", ]
            energy: 4
            agility: 0
            hull: 8
            shields: 4
            actions: [
                "Recover"
                "Reinforce"
                "Coordinate"
                "Jam"
            ]
            huge: true
            epic_points: 2
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0 ]
                [ 0, 1, 1, 1, 0, 0 ]
                [ 0, 1, 1, 1, 0, 0 ]
                [ 0, 0, 1, 0, 0, 0 ]
                [ 0, 0, 1, 0, 0, 0 ]
            ]
        "Z-95 Headhunter":
            name: "Z-95 Headhunter"
            factions: [ "Rebel Alliance", "Scum and Villainy", ]
            attack: 2
            agility: 2
            hull: 2
            shields: 2
            actions: [
                "Focus"
                "Target Lock"
            ]
            maneuvers: [
              [ 0, 0, 0, 0, 0, 0]
              [ 0, 1, 2, 1, 0, 0]
              [ 1, 2, 2, 2, 1, 0]
              [ 1, 1, 1, 1, 1, 3]
              [ 0, 0, 1, 0, 0, 0]
            ]
        "TIE Defender":
            name: "TIE Defender"
            factions: [ "Galactic Empire", ]
            attack: 3
            agility: 3
            hull: 3
            shields: 3
            actions: [
                "Focus"
                "Target Lock"
                "Barrel Roll"
            ]
            maneuvers: [
              [ 0, 0, 0, 0, 0, 0]
              [ 3, 1, 0, 1, 3, 0]
              [ 3, 1, 2, 1, 3, 0]
              [ 1, 1, 2, 1, 1, 0]
              [ 0, 0, 2, 0, 0, 1]
              [ 0, 0, 2, 0, 0, 0]
            ]
        "E-Wing":
            name: "E-Wing"
            factions: [ "Rebel Alliance", ]
            attack: 3
            agility: 3
            hull: 2
            shields: 3
            actions: [
                "Focus"
                "Target Lock"
                "Barrel Roll"
                "Evade"
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0 ]
                [ 0, 1, 2, 1, 0, 0 ]
                [ 1, 2, 2, 2, 1, 0 ]
                [ 1, 1, 2, 1, 1, 3 ]
                [ 0, 0, 1, 0, 0, 3 ]
                [ 0, 0, 1, 0, 0, 0 ]
            ]
        "TIE Phantom":
            name: "TIE Phantom"
            factions: [ "Galactic Empire", ]
            attack: 4
            agility: 2
            hull: 2
            shields: 2
            actions: [
                "Focus"
                "Barrel Roll"
                "Evade"
                "Cloak"
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0]
                [ 1, 0, 0, 0, 1, 0]
                [ 1, 2, 2, 2, 1, 0]
                [ 1, 1, 2, 1, 1, 3]
                [ 0, 0, 1, 0, 0, 3]
            ]
        "CR90 Corvette (Fore)":
            name: "CR90 Corvette (Fore)"
            factions: [ "Rebel Alliance", ]
            attack: 4
            agility: 0
            hull: 8
            shields: 5
            actions: [
                "Coordinate"
                "Target Lock"
            ]
            huge: true
            epic_points: 1.5
            attack_icon: 'xwing-miniatures-font-attack-turret'
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0]
                [ 0, 1, 0, 1, 0, 0]
                [ 0, 1, 1, 1, 0, 0]
                [ 0, 0, 1, 0, 0, 0]
                [ 0, 0, 1, 0, 0, 0]
            ]
            multisection: [
                "CR90 Corvette (Aft)".canonicalize()
            ]
            canonical_name: "CR90 Corvette".canonicalize()
        "CR90 Corvette (Aft)":
            name: "CR90 Corvette (Aft)"
            factions: [ "Rebel Alliance", ]
            energy: 5
            agility: 0
            hull: 8
            shields: 3
            actions: [
                "Reinforce"
                "Recover"
            ]
            huge: true
            epic_points: 1.5
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0]
                [ 0, 1, 0, 1, 0, 0]
                [ 0, 1, 1, 1, 0, 0]
                [ 0, 0, 1, 0, 0, 0]
                [ 0, 0, 1, 0, 0, 0]
            ]
            multisection: [
                "CR90 Corvette (Fore)".canonicalize()
            ]
            canonical_name: "CR90 Corvette".canonicalize()
        "YT-2400":
            name: "YT-2400"
            factions: [ "Rebel Alliance", ]
            attack: 2
            agility: 2
            hull: 5
            shields: 5
            actions: [
                "Focus"
                "Target Lock"
                "Barrel Roll"
            ]
            large: true
            attack_icon: 'xwing-miniatures-font-attack-turret'
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0]
                [ 1, 2, 2, 2, 1, 0]
                [ 1, 1, 2, 1, 1, 0]
                [ 1, 1, 1, 1, 1, 0]
                [ 0, 0, 1, 0, 0, 3]
            ]
        "VT-49 Decimator":
            name: "VT-49 Decimator"
            factions: [ "Galactic Empire", ]
            attack: 3
            agility: 0
            hull: 12
            shields: 4
            actions: [
                "Focus"
                "Target Lock"
            ]
            large: true
            attack_icon: 'xwing-miniatures-font-attack-turret'
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0]
                [ 0, 1, 1, 1, 0, 0]
                [ 1, 2, 2, 2, 1, 0]
                [ 1, 1, 2, 1, 1, 0]
                [ 0, 0, 1, 0, 0, 0]
            ]
        "StarViper":
            name: "StarViper"
            factions: ["Scum and Villainy"]
            attack: 3
            agility: 3
            hull: 4
            shields: 1
            actions: [
                "Focus"
                "Target Lock"
                "Barrel Roll"
                "Boost"
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0, 0, 0]
                [ 1, 2, 2, 2, 1, 0, 0, 0]
                [ 1, 1, 2, 1, 1, 0, 0, 0]
                [ 0, 1, 2, 1, 0, 0, 3, 3]
                [ 0, 0, 1, 0, 0, 0, 0, 0]
            ]
        "M3-A Interceptor":
            name: "M3-A Interceptor"
            factions: [ "Scum and Villainy" ]
            attack: 2
            agility: 3
            hull: 2
            shields: 1
            actions: [
                "Focus"
                "Target Lock"
                "Barrel Roll"
                "Evade"
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0 ]
                [ 1, 2, 0, 2, 1, 0 ]
                [ 1, 2, 2, 2, 1, 0 ]
                [ 0, 1, 2, 1, 0, 3 ]
                [ 0, 0, 1, 0, 0, 0 ]
                [ 0, 0, 0, 0, 0, 3 ]
            ]
        "Aggressor":
            name: "Aggressor"
            factions: [ "Scum and Villainy" ]
            attack: 3
            agility: 3
            hull: 4
            shields: 4
            actions: [
                "Focus"
                "Target Lock"
                "Boost"
                "Evade"
            ]
            large: true
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0, 0, 0 ]
                [ 1, 2, 2, 2, 1, 0, 0, 0 ]
                [ 1, 2, 2, 2, 1, 0, 0, 0 ]
                [ 0, 2, 2, 2, 0, 0, 3, 3 ]
                [ 0, 0, 0, 0, 0, 3, 0, 0 ]
            ]
        "Raider-class Corvette (Fore)":
            name: "Raider-class Corvette (Fore)"
            factions: [ "Galactic Empire" ]
            attack: 4
            agility: 0
            hull: 8
            shields: 6
            actions: [
                "Recover"
                "Reinforce"
            ]
            huge: true
            epic_points: 1.5
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0 ]
                [ 0, 1, 1, 1, 0, 0 ]
                [ 0, 1, 1, 1, 0, 0 ]
                [ 0, 0, 1, 0, 0, 0 ]
                [ 0, 0, 1, 0, 0, 0 ]
            ]
            multisection: [
                "Raider-class Corvette (Aft)".canonicalize()
            ]
            canonical_name: "Raider-class Corvette".canonicalize()
        "Raider-class Corvette (Aft)":
            name: "Raider-class Corvette (Aft)"
            factions: [ "Galactic Empire" ]
            energy: 6
            agility: 0
            hull: 8
            shields: 4
            actions: [
                "Coordinate"
                "Target Lock"
            ]
            huge: true
            epic_points: 1.5
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0 ]
                [ 0, 1, 1, 1, 0, 0 ]
                [ 0, 1, 1, 1, 0, 0 ]
                [ 0, 0, 1, 0, 0, 0 ]
                [ 0, 0, 1, 0, 0, 0 ]
            ]
            multisection: [
                "Raider-class Corvette (Fore)".canonicalize()
            ]
            canonical_name: "Raider-class Corvette".canonicalize()
        "YV-666":
            name: "YV-666"
            factions: [ "Scum and Villainy" ]
            attack: 3
            agility: 1
            hull: 6
            shields: 6
            large: true
            actions: [
                "Focus"
                "Target Lock"
            ]
            attack_icon: 'xwing-miniatures-font-attack-180'
            maneuvers: [
                [ 0, 0, 3, 0, 0, 0 ]
                [ 0, 2, 2, 2, 0, 0 ]
                [ 3, 1, 2, 1, 3, 0 ]
                [ 1, 1, 2, 1, 1, 0 ]
                [ 0, 0, 1, 0, 0, 0 ]
            ]
        "Kihraxz Fighter":
            name: "Kihraxz Fighter"
            factions: ["Scum and Villainy"]
            attack: 3
            agility: 2
            hull: 4
            shields: 1
            actions: [
                "Focus"
                "Target Lock"
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0 ]
                [ 1, 2, 0, 2, 1, 0 ]
                [ 1, 2, 2, 2, 1, 0 ]
                [ 0, 1, 1, 1, 0, 0 ]
                [ 0, 0, 1, 0, 0, 3 ]
                [ 0, 0, 0, 0, 0, 3 ]
            ]
        "K-Wing":
            name: "K-Wing"
            factions: ["Rebel Alliance"]
            attack: 2
            agility: 1
            hull: 5
            shields: 4
            actions: [
                "Focus"
                "Target Lock"
                "SLAM"
            ]
            attack_icon: 'xwing-miniatures-font-attack-turret'
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0 ]
                [ 0, 2, 2, 2, 0, 0 ]
                [ 1, 1, 2, 1, 1, 0 ]
                [ 0, 1, 1, 1, 0, 0 ]
            ]
        "TIE Punisher":
            name: "TIE Punisher"
            factions: ["Galactic Empire"]
            attack: 2
            agility: 1
            hull: 6
            shields: 3
            actions: [
                "Focus"
                "Target Lock"
                "Boost"
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0 ]
                [ 0, 2, 2, 2, 0, 0 ]
                [ 3, 1, 2, 1, 3, 0 ]
                [ 1, 1, 1, 1, 1, 0 ]
                [ 0, 0, 0, 0, 0, 3 ]
            ]
        "Gozanti-class Cruiser":
            name: "Gozanti-class Cruiser"
            factions: ["Galactic Empire"]
            energy: 4
            agility: 0
            hull: 9
            shields: 5
            huge: true
            epic_points: 2 # guessing it's the same as rebel transport
            actions: [
                "Recover"
                "Reinforce"
                "Coordinate"
                "Target Lock"
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0 ]
                [ 0, 1, 1, 1, 0, 0 ]
                [ 0, 1, 1, 1, 0, 0 ]
                [ 0, 0, 1, 0, 0, 0 ]
                [ 0, 0, 1, 0, 0, 0 ]
            ]
        "VCX-100":
            name: "VCX-100"
            factions: ["Rebel Alliance"]
            attack: 4
            agility: 0
            hull: 10
            shields: 6
            large: true
            actions: [
                "Focus"
                "Target Lock"
                "Evade"
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0 ]
                [ 3, 1, 2, 1, 3, 0 ]
                [ 1, 2, 2, 2, 1, 0 ]
                [ 3, 1, 1, 1, 3, 0 ]
                [ 0, 0, 1, 0, 0, 0 ]
                [ 0, 0, 0, 0, 0, 3 ]
            ]
        "Attack Shuttle":
            name: "Attack Shuttle"
            factions: ["Rebel Alliance"]
            attack: 3
            agility: 2
            hull: 2
            shields: 2
            actions: [
                "Focus"
                "Barrel Roll"
                "Evade"
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0 ]
                [ 3, 2, 2, 2, 3, 0 ]
                [ 1, 1, 2, 1, 1, 0 ]
                [ 3, 1, 1, 1, 3, 0 ]
                [ 0, 0, 1, 0, 0, 3 ]
            ]
        "TIE Advanced Prototype":
            name: "TIE Advanced Prototype"
            canonical_name: 'TIE Adv. Prototype'.canonicalize()
            factions: ["Galactic Empire"]
            attack: 2
            agility: 3
            hull: 2
            shields: 2
            actions: [
                "Focus"
                "Target Lock"
                "Barrel Roll"
                "Boost"
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0 ]
                [ 2, 2, 0, 2, 2, 0 ]
                [ 1, 1, 2, 1, 1, 0 ]
                [ 1, 1, 2, 1, 1, 0 ]
                [ 0, 0, 2, 0, 0, 3 ]
                [ 0, 0, 1, 0, 0, 0 ]
            ]
        "G-1A Starfighter":
            name: "G-1A Starfighter"
            factions: ["Scum and Villainy"]
            attack: 3
            agility: 1
            hull: 4
            shields: 4
            actions: [
                "Focus"
                "Target Lock"
                "Evade"
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0 ]
                [ 3, 2, 2, 2, 3, 0 ]
                [ 1, 1, 2, 1, 1, 0 ]
                [ 0, 3, 2, 3, 0, 3 ]
                [ 0, 0, 1, 0, 0, 3 ]
            ]
        "JumpMaster 5000":
            name: "JumpMaster 5000"
            factions: ["Scum and Villainy"]
            large: true
            attack: 2
            agility: 2
            hull: 5
            shields: 4
            actions: [
                "Focus"
                "Target Lock"
                "Barrel Roll"
            ]
            attack_icon: 'xwing-miniatures-font-attack-turret'
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0, 0, 0 ]
                [ 2, 2, 2, 1, 1, 0, 0, 0 ]
                [ 2, 2, 2, 1, 1, 0, 1, 3 ]
                [ 0, 1, 1, 1, 0, 0, 0, 0 ]
                [ 0, 0, 1, 0, 0, 3, 0, 0 ]
            ]
        "T-70 X-Wing":
            name: "T-70 X-Wing"
            factions: ["Resistance"]
            attack: 3
            agility: 2
            hull: 3
            shields: 3
            actions: [
                "Focus"
                "Target Lock"
                "Boost"
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                [ 0, 2, 2, 2, 0, 0, 0, 0, 0, 0 ]
                [ 1, 1, 2, 1, 1, 0, 0, 0, 0, 0 ]
                [ 1, 1, 2, 1, 1, 0, 0, 0, 3, 3 ]
                [ 0, 0, 1, 0, 0, 3, 0, 0, 0, 0 ]
            ]
        "TIE/fo Fighter":
            name: "TIE/fo Fighter"
            factions: ["First Order"]
            attack: 2
            agility: 3
            hull: 3
            shields: 1
            actions: [
                "Focus"
                "Target Lock"
                "Barrel Roll"
                "Evade"
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0, 0, 0 ]
                [ 1, 0, 0, 0, 1, 0, 0, 0 ]
                [ 2, 2, 2, 2, 2, 0, 3, 3 ]
                [ 1, 1, 2, 1, 1, 0, 0, 0 ]
                [ 0, 0, 1, 0, 0, 3, 0, 0 ]
                [ 0, 0, 1, 0, 0, 0, 0, 0 ]
            ]
        'ARC-170':
            name: 'ARC-170'
            factions: ["Rebel Alliance"]
            attack: 2
            agility: 1
            hull: 6
            shields: 3
            actions: [
                "Focus"
                "Target Lock"
            ]
            attack_icon: 'xwing-miniatures-font-attack-frontback'
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0 ]
                [ 0, 2, 2, 2, 0, 0 ]
                [ 1, 2, 2, 2, 1, 0 ]
                [ 3, 1, 1, 1, 3, 0 ]
                [ 0, 0, 3, 0, 0, 3 ]
            ]
        'TIE/sf Fighter':
            name: 'TIE/sf Fighter'
            factions: ["First Order"]
            attack: 2
            agility: 2
            hull: 3
            shields: 3
            actions: [
                'Focus'
                'Target Lock'
                'Barrel Roll'
            ]
            attack_icon: 'xwing-miniatures-font-attack-frontback'
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0, 0, 0 ]
                [ 3, 2, 2, 2, 3, 0, 0, 0 ]
                [ 1, 1, 2, 1, 1, 0, 0, 0 ]
                [ 3, 1, 2, 1, 3, 0, 3, 3 ]
                [ 0, 0, 1, 0, 0, 0, 0, 0 ]
            ]
        'Protectorate Starfighter':
            name: 'Protectorate Starfighter'
            factions: ["Scum and Villainy"]
            attack: 3
            agility: 3
            hull: 4
            shields: 0
            actions: [
                'Focus'
                'Target Lock'
                'Barrel Roll'
                'Boost'
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                [ 1, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                [ 2, 2, 2, 2, 2, 0, 0, 0, 3, 3 ]
                [ 1, 1, 2, 1, 1, 0, 0, 0, 0, 0 ]
                [ 0, 0, 1, 0, 0, 3, 0, 0, 0, 0 ]
                [ 0, 0, 1, 0, 0, 0, 0, 0, 0, 0 ]
            ]
        'Lancer-class Pursuit Craft':
            name: 'Lancer-class Pursuit Craft'
            factions: ["Scum and Villainy"]
            large: true
            attack: 3
            agility: 2
            hull: 7
            shields: 3
            actions: [
                'Focus'
                'Target Lock'
                'Evade'
                'Rotate Arc'
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0]
                [ 0, 1, 1, 1, 0, 0]
                [ 1, 1, 2, 1, 1, 0]
                [ 2, 2, 2, 2, 2, 0]
                [ 0, 0, 2, 0, 0, 0]
                [ 0, 0, 1, 0, 0, 3]
            ]
        'Upsilon-class Shuttle':
            name: 'Upsilon-class Shuttle'
            factions: ["First Order"]
            large: true
            attack: 4
            agility: 1
            hull: 6
            shields: 6
            actions: [
                'Focus'
                'Target Lock'
                'Coordinate'
            ]
            maneuvers: [
              [ 0, 0, 3, 0, 0]
              [ 3, 1, 2, 1, 3]
              [ 1, 2, 2, 2, 1]
              [ 3, 1, 1, 1, 3]
            ]
        'Quadjumper':
            name: 'Quadjumper'
            factions: ["Scum and Villainy"]
            attack: 2
            agility: 2
            hull: 5
            shields: 0
            actions: [
                'Barrel Roll'
                'Focus'
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                [ 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 3, 3, 3 ]
                [ 1, 2, 2, 2, 1, 0, 3, 3, 0, 0, 0, 0, 0 ]
                [ 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
            ]
        'U-Wing':
            name: 'U-Wing'
            factions: ["Rebel Alliance"]
            large: true
            attack: 3
            agility: 1
            hull: 4
            shields: 4
            actions: [
                'Focus'
                'Target Lock'
            ]
            maneuvers: [
                [ 0, 0, 3, 0, 0 ]
                [ 0, 2, 2, 2, 0 ]
                [ 1, 2, 2, 2, 1 ]
                [ 0, 1, 1, 1, 0 ]
                [ 0, 0, 1, 0, 0 ]
            ]
        'TIE Striker':
            name: 'TIE Striker'
            factions: ["Galactic Empire"]
            attack: 3
            agility: 2
            hull: 4
            shields: 0
            actions: [
                'Focus'
                'Barrel Roll'
                'Evade'
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0, 0, 0 ]
                [ 1, 2, 2, 2, 1, 0, 0, 0 ]
                [ 1, 1, 2, 1, 1, 3, 3, 3 ]
                [ 0, 1, 2, 1, 0, 0, 0, 0 ]
            ]
        "C-ROC Cruiser":
            name: "C-ROC Cruiser"
            factions: ["Scum and Villainy"]
            energy: 4
            agility: 0
            hull: 10
            shields: 4
            huge: true
            actions: [
                "Recover"
                "Reinforce"
                "Target Lock"
                "Jam"
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0 ]
                [ 0, 1, 1, 1, 0, 0 ]
                [ 0, 1, 1, 1, 0, 0 ]
                [ 0, 0, 1, 0, 0, 0 ]
                [ 0, 0, 1, 0, 0, 0 ]
            ]
        'Auzituck Gunship':
            name: 'Auzituck Gunship'
            factions: ["Rebel Alliance"]
            attack: 3
            agility: 1
            hull: 6
            shields: 3
            actions: [
                'Focus'
                'Reinforce'
            ]
            attack_icon: 'xwing-miniatures-font-attack-180'
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0, 0, 0 ]
                [ 0, 2, 2, 2, 0, 0, 0, 0 ]
                [ 1, 1, 2, 1, 1, 0, 0, 0 ]
                [ 1, 1, 2, 1, 1, 0, 0, 0 ]
                [ 0, 0, 1, 0, 0, 0, 0, 0 ]
                [ 0, 0, 3, 0, 0, 0, 0, 0 ]
            ]
        'Scurrg H-6 Bomber':
            name: 'Scurrg H-6 Bomber'
            factions: ["Rebel Alliance", "Scum and Villainy"]
            attack: 3
            agility: 1
            hull: 5
            shields: 5
            actions: [
                'Focus'
                'Target Lock'
                'Barrel Roll'
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                [ 0, 1, 2, 1, 0, 0, 0, 0, 0, 0 ]
                [ 1, 2, 2, 2, 1, 0, 0, 0, 0, 0 ]
                [ 3, 1, 2, 1, 3, 0, 0, 0, 3, 3 ]
                [ 0, 0, 1, 0, 0, 0, 0, 0, 0, 0 ]
                [ 0, 0, 3, 0, 0, 0, 0, 0, 0, 0 ]
            ]
        'TIE Aggressor':
            name: 'TIE Aggressor'
            factions: ["Galactic Empire"]
            attack: 2
            agility: 2
            hull: 4
            shields: 1
            actions: [
                'Focus'
                'Target Lock'
                'Barrel Roll'
            ]
            maneuvers: [
                [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                [ 0, 1, 2, 1, 0, 0, 0, 0, 0, 0 ]
                [ 1, 2, 2, 2, 1, 0, 0, 0, 0, 0 ]
                [ 1, 1, 2, 1, 1, 0, 0, 0, 0, 0 ]
                [ 0, 0, 1, 0, 0, 3, 0, 0, 0, 0 ]
            ]
        'Alpha-class Star Wing':
            name: 'Alpha-class Star Wing'
            factions: ["Disabled"]
            attack: 2
            agility: 2
            hull: 4
            shields: 3
            actions: [
                'Target Lock'
                'Focus'
                'SLAM'
                'Reload'
            ]
        'M12-L Kimogila Fighter':
            name: 'M12-L Kimogila Fighter'
            factions: ["Disabled"]
            attack: 3
            agility: 1
            hull: 6
            shields: 2
            actions: [
                'Target Lock'
                'Focus'
                'Barrel Roll'
                'Reload'
            ]
        'Sheathipede-class Shuttle':
            name: 'Sheathipede-class Shuttle'
            factions: ["Disabled"]
            attack: 2
            agility: 2
            hull: 4
            shields: 1
            actions: [
                'Focus'
                'Target Lock'
                'Coordinate'
            ]
            attack_icon: 'xwing-miniatures-font-attack-frontback'
        'B/SF-17 Bomber':
            name: 'B/SF-17 Bomber'
            factions: ["Disabled"]
            large: true
            attack: 2
            agility: 1
            hull: 9
            shields: 3
            actions: [
                'Focus'
                'Target Lock'
            ]
            attack_icon: 'xwing-miniatures-font-attack-turret'
        'TIE Silencer':
            name: 'TIE Silencer'
            factions: ["Disabled"]
            attack: 3
            agility: 3
            hull: 4
            shields: 2
            actions: [
                'Focus'
                'Barrel Roll'
                'Boost'
                'Target Lock'
            ]

    # name field is for convenience only
    pilotsById: [
        {
            name: "Wedge Antilles"
            faction: "Rebel Alliance"
            id: 0
            unique: true
            ship: "X-Wing"
            skill: 9
            points: 29
            slots: [
                "Elite"
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Garven Dreis"
            faction: "Rebel Alliance"
            id: 1
            unique: true
            ship: "X-Wing"
            skill: 6
            points: 26
            slots: [
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Red Squadron Pilot"
            faction: "Rebel Alliance"
            id: 2
            ship: "X-Wing"
            skill: 4
            points: 23
            slots: [
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Rookie Pilot"
            faction: "Rebel Alliance"
            id: 3
            ship: "X-Wing"
            skill: 2
            points: 21
            slots: [
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Biggs Darklighter"
            faction: "Rebel Alliance"
            id: 4
            unique: true
            ship: "X-Wing"
            skill: 5
            points: 25
            slots: [
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Luke Skywalker"
            faction: "Rebel Alliance"
            id: 5
            unique: true
            ship: "X-Wing"
            skill: 8
            points: 28
            slots: [
                "Elite"
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Gray Squadron Pilot"
            faction: "Rebel Alliance"
            id: 6
            ship: "Y-Wing"
            skill: 4
            points: 20
            slots: [
                "Turret"
                "Torpedo"
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: '"Dutch" Vander'
            faction: "Rebel Alliance"
            id: 7
            unique: true
            ship: "Y-Wing"
            skill: 6
            points: 23
            slots: [
                "Turret"
                "Torpedo"
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Horton Salm"
            faction: "Rebel Alliance"
            id: 8
            unique: true
            ship: "Y-Wing"
            skill: 8
            points: 25
            slots: [
                "Turret"
                "Torpedo"
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Gold Squadron Pilot"
            faction: "Rebel Alliance"
            id: 9
            ship: "Y-Wing"
            skill: 2
            points: 18
            slots: [
                "Turret"
                "Torpedo"
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Academy Pilot"
            faction: "Galactic Empire"
            id: 10
            ship: "TIE Fighter"
            skill: 1
            points: 12
            slots: []
        }
        {
            name: "Obsidian Squadron Pilot"
            faction: "Galactic Empire"
            id: 11
            ship: "TIE Fighter"
            skill: 3
            points: 13
            slots: []
        }
        {
            name: "Black Squadron Pilot"
            faction: "Galactic Empire"
            id: 12
            ship: "TIE Fighter"
            skill: 4
            points: 14
            slots: [
                "Elite"
            ]
        }
        {
            name: '"Winged Gundark"'
            faction: "Galactic Empire"
            id: 13
            unique: true
            ship: "TIE Fighter"
            skill: 5
            points: 15
            slots: [ ]
        }
        {
            name: '"Night Beast"'
            faction: "Galactic Empire"
            id: 14
            unique: true
            ship: "TIE Fighter"
            skill: 5
            points: 15
            slots: [ ]
        }
        {
            name: '"Backstabber"'
            faction: "Galactic Empire"
            id: 15
            unique: true
            ship: "TIE Fighter"
            skill: 6
            points: 16
            slots: [ ]
        }
        {
            name: '"Dark Curse"'
            faction: "Galactic Empire"
            id: 16
            unique: true
            ship: "TIE Fighter"
            skill: 6
            points: 16
            slots: [ ]
        }
        {
            name: '"Mauler Mithel"'
            faction: "Galactic Empire"
            id: 17
            unique: true
            ship: "TIE Fighter"
            skill: 7
            points: 17
            slots: [
                "Elite"
            ]
        }
        {
            name: '"Howlrunner"'
            faction: "Galactic Empire"
            id: 18
            unique: true
            ship: "TIE Fighter"
            skill: 8
            points: 18
            slots: [
                "Elite"
            ]
        }
        {
            name: "Maarek Stele"
            faction: "Galactic Empire"
            id: 19
            unique: true
            ship: "TIE Advanced"
            skill: 7
            points: 27
            slots: [
                "Elite"
                "Missile"
            ]
        }
        {
            name: "Tempest Squadron Pilot"
            faction: "Galactic Empire"
            id: 20
            ship: "TIE Advanced"
            skill: 2
            points: 21
            slots: [
                "Missile"
            ]
        }
        {
            name: "Storm Squadron Pilot"
            faction: "Galactic Empire"
            id: 21
            ship: "TIE Advanced"
            skill: 4
            points: 23
            slots: [
                "Missile"
            ]
        }
        {
            name: "Darth Vader"
            faction: "Galactic Empire"
            id: 22
            unique: true
            ship: "TIE Advanced"
            skill: 9
            points: 29
            slots: [
                "Elite"
                "Missile"
            ]
        }
        {
            name: "Alpha Squadron Pilot"
            faction: "Galactic Empire"
            id: 23
            ship: "TIE Interceptor"
            skill: 1
            points: 18
            slots: [ ]
        }
        {
            name: "Avenger Squadron Pilot"
            faction: "Galactic Empire"
            id: 24
            ship: "TIE Interceptor"
            skill: 3
            points: 20
            slots: [ ]
        }
        {
            name: "Saber Squadron Pilot"
            faction: "Galactic Empire"
            id: 25
            ship: "TIE Interceptor"
            skill: 4
            points: 21
            slots: [
                "Elite"
            ]
        }
        {
            name: "\"Fel's Wrath\""
            faction: "Galactic Empire"
            id: 26
            unique: true
            ship: "TIE Interceptor"
            skill: 5
            points: 23
            slots: [ ]
        }
        {
            name: "Turr Phennir"
            faction: "Galactic Empire"
            id: 27
            unique: true
            ship: "TIE Interceptor"
            skill: 7
            points: 25
            slots: [
                "Elite"
            ]
        }
        {
            name: "Soontir Fel"
            faction: "Galactic Empire"
            id: 28
            unique: true
            ship: "TIE Interceptor"
            skill: 9
            points: 27
            slots: [
                "Elite"
            ]
        }
        {
            name: "Tycho Celchu"
            faction: "Rebel Alliance"
            id: 29
            unique: true
            ship: "A-Wing"
            skill: 8
            points: 26
            slots: [
                "Elite"
                "Missile"
            ]
        }
        {
            name: "Arvel Crynyd"
            faction: "Rebel Alliance"
            id: 30
            unique: true
            ship: "A-Wing"
            skill: 6
            points: 23
            slots: [
                "Missile"
            ]
        }
        {
            name: "Green Squadron Pilot"
            faction: "Rebel Alliance"
            id: 31
            ship: "A-Wing"
            skill: 3
            points: 19
            slots: [
                "Elite"
                "Missile"
            ]
        }
        {
            name: "Prototype Pilot"
            faction: "Rebel Alliance"
            id: 32
            ship: "A-Wing"
            skill: 1
            points: 17
            slots: [
                "Missile"
            ]
        }
        {
            name: "Outer Rim Smuggler"
            faction: "Rebel Alliance"
            id: 33
            ship: "YT-1300"
            skill: 1
            points: 27
            slots: [
                "Crew"
                "Crew"
            ]
        }
        {
            name: "Chewbacca"
            faction: "Rebel Alliance"
            id: 34
            unique: true
            ship: "YT-1300"
            skill: 5
            points: 42
            slots: [
                "Elite"
                "Missile"
                "Crew"
                "Crew"
            ]
            ship_override:
                attack: 3
                agility: 1
                hull: 8
                shields: 5
        }
        {
            name: "Lando Calrissian"
            faction: "Rebel Alliance"
            id: 35
            unique: true
            ship: "YT-1300"
            skill: 7
            points: 44
            slots: [
                "Elite"
                "Missile"
                "Crew"
                "Crew"
            ]
            ship_override:
                attack: 3
                agility: 1
                hull: 8
                shields: 5
        }
        {
            name: "Han Solo"
            faction: "Rebel Alliance"
            id: 36
            unique: true
            ship: "YT-1300"
            skill: 9
            points: 46
            slots: [
                "Elite"
                "Missile"
                "Crew"
                "Crew"
            ]
            ship_override:
                attack: 3
                agility: 1
                hull: 8
                shields: 5
        }
        {
            name: "Kath Scarlet"
            faction: "Galactic Empire"
            id: 37
            unique: true
            ship: "Firespray-31"
            skill: 7
            points: 38
            slots: [
                "Elite"
                "Cannon"
                "Bomb"
                "Crew"
                "Missile"
            ]
        }
        {
            name: "Boba Fett"
            faction: "Galactic Empire"
            id: 38
            unique: true
            ship: "Firespray-31"
            skill: 8
            points: 39
            slots: [
                "Elite"
                "Cannon"
                "Bomb"
                "Crew"
                "Missile"
            ]
        }
        {
            name: "Krassis Trelix"
            faction: "Galactic Empire"
            id: 39
            unique: true
            ship: "Firespray-31"
            skill: 5
            points: 36
            slots: [
                "Cannon"
                "Bomb"
                "Crew"
                "Missile"
            ]
        }
        {
            name: "Bounty Hunter"
            faction: "Galactic Empire"
            id: 40
            ship: "Firespray-31"
            skill: 3
            points: 33
            slots: [
                "Cannon"
                "Bomb"
                "Crew"
                "Missile"
            ]
        }
        {
            name: "Ten Numb"
            faction: "Rebel Alliance"
            id: 41
            unique: true
            ship: "B-Wing"
            skill: 8
            points: 31
            slots: [
                "Elite"
                "System"
                "Cannon"
                "Torpedo"
                "Torpedo"
            ]
        }
        {
            name: "Ibtisam"
            faction: "Rebel Alliance"
            id: 42
            unique: true
            ship: "B-Wing"
            skill: 6
            points: 28
            slots: [
                "Elite"
                "System"
                "Cannon"
                "Torpedo"
                "Torpedo"
            ]
        }
        {
            name: "Dagger Squadron Pilot"
            faction: "Rebel Alliance"
            id: 43
            ship: "B-Wing"
            skill: 4
            points: 24
            slots: [
                "System"
                "Cannon"
                "Torpedo"
                "Torpedo"
            ]
        }
        {
            name: "Blue Squadron Pilot"
            faction: "Rebel Alliance"
            id: 44
            ship: "B-Wing"
            skill: 2
            points: 22
            slots: [
                "System"
                "Cannon"
                "Torpedo"
                "Torpedo"
            ]
        }
        {
            name: "Rebel Operative"
            faction: "Rebel Alliance"
            id: 45
            ship: "HWK-290"
            skill: 2
            points: 16
            slots: [
                "Turret"
                "Crew"
            ]
        }
        {
            name: "Roark Garnet"
            faction: "Rebel Alliance"
            id: 46
            unique: true
            ship: "HWK-290"
            skill: 4
            points: 19
            slots: [
                "Turret"
                "Crew"
            ]
        }
        {
            name: "Kyle Katarn"
            faction: "Rebel Alliance"
            id: 47
            unique: true
            ship: "HWK-290"
            skill: 6
            points: 21
            slots: [
                "Elite"
                "Turret"
                "Crew"
            ]
        }
        {
            name: "Jan Ors"
            faction: "Rebel Alliance"
            id: 48
            unique: true
            ship: "HWK-290"
            skill: 8
            points: 25
            slots: [
                "Elite"
                "Turret"
                "Crew"
            ]
        }
        {
            name: "Scimitar Squadron Pilot"
            faction: "Galactic Empire"
            id: 49
            ship: "TIE Bomber"
            skill: 2
            points: 16
            slots: [
                "Torpedo"
                "Torpedo"
                "Missile"
                "Missile"
                "Bomb"
            ]
        }
        {
            name: "Gamma Squadron Pilot"
            faction: "Galactic Empire"
            id: 50
            ship: "TIE Bomber"
            skill: 4
            points: 18
            slots: [
                "Torpedo"
                "Torpedo"
                "Missile"
                "Missile"
                "Bomb"
            ]
        }
        {
            name: "Captain Jonus"
            faction: "Galactic Empire"
            id: 51
            unique: true
            ship: "TIE Bomber"
            skill: 6
            points: 22
            slots: [
                "Elite"
                "Torpedo"
                "Torpedo"
                "Missile"
                "Missile"
                "Bomb"
            ]
        }
        {
            name: "Major Rhymer"
            faction: "Galactic Empire"
            id: 52
            unique: true
            ship: "TIE Bomber"
            skill: 7
            points: 26
            slots: [
                "Elite"
                "Torpedo"
                "Torpedo"
                "Missile"
                "Missile"
                "Bomb"
            ]
        }
        {
            name: "Captain Kagi"
            faction: "Galactic Empire"
            id: 53
            unique: true
            ship: "Lambda-Class Shuttle"
            skill: 8
            points: 27
            slots: [
                "System"
                "Cannon"
                "Crew"
                "Crew"
            ]
        }
        {
            name: "Colonel Jendon"
            faction: "Galactic Empire"
            id: 54
            unique: true
            ship: "Lambda-Class Shuttle"
            skill: 6
            points: 26
            slots: [
                "System"
                "Cannon"
                "Crew"
                "Crew"
            ]
        }
        {
            name: "Captain Yorr"
            faction: "Galactic Empire"
            id: 55
            unique: true
            ship: "Lambda-Class Shuttle"
            skill: 4
            points: 24
            slots: [
                "System"
                "Cannon"
                "Crew"
                "Crew"
            ]
        }
        {
            name: "Omicron Group Pilot"
            faction: "Galactic Empire"
            id: 56
            ship: "Lambda-Class Shuttle"
            skill: 2
            points: 21
            slots: [
                "System"
                "Cannon"
                "Crew"
                "Crew"
            ]
        }
        {
            name: "Lieutenant Lorrir"
            faction: "Galactic Empire"
            id: 57
            unique: true
            ship: "TIE Interceptor"
            skill: 5
            points: 23
            slots: [ ]
        }
        {
            name: "Royal Guard Pilot"
            faction: "Galactic Empire"
            id: 58
            ship: "TIE Interceptor"
            skill: 6
            points: 22
            slots: [
                "Elite"
            ]
        }
        {
            name: "Tetran Cowall"
            faction: "Galactic Empire"
            id: 59
            unique: true
            ship: "TIE Interceptor"
            skill: 7
            points: 24
            slots: [
                "Elite"
            ]
            modifier_func: (stats) ->
                # add speed 1 k-turn to table (Interceptor already has 3/5)
                stats.maneuvers[1][5] = 3
        }
        {
            name: "I messed up this pilot, sorry"
            id: 60
            skip: true
        }
        {
            name: "Kir Kanos"
            faction: "Galactic Empire"
            id: 61
            unique: true
            ship: "TIE Interceptor"
            skill: 6
            points: 24
            slots: [ ]
        }
        {
            name: "Carnor Jax"
            faction: "Galactic Empire"
            id: 62
            unique: true
            ship: "TIE Interceptor"
            skill: 8
            points: 26
            slots: [
                "Elite"
            ]
        }
        {
            name: "GR-75 Medium Transport"
            faction: "Rebel Alliance"
            id: 63
            epic: true
            ship: "GR-75 Medium Transport"
            skill: 3
            points: 30
            slots: [
                "Crew"
                "Crew"
                "Cargo"
                "Cargo"
                "Cargo"
            ]
        }
        {
            name: "Bandit Squadron Pilot"
            faction: "Rebel Alliance"
            id: 64
            ship: "Z-95 Headhunter"
            skill: 2
            points: 12
            slots: [
                "Missile"
            ]
        }
        {
            name: "Tala Squadron Pilot"
            faction: "Rebel Alliance"
            id: 65
            ship: "Z-95 Headhunter"
            skill: 4
            points: 13
            slots: [
                "Missile"
            ]
        }
        {
            name: "Lieutenant Blount"
            faction: "Rebel Alliance"
            id: 66
            unique: true
            ship: "Z-95 Headhunter"
            skill: 6
            points: 17
            slots: [
                "Elite"
                "Missile"
            ]
        }
        {
            name: "Airen Cracken"
            faction: "Rebel Alliance"
            id: 67
            unique: true
            ship: "Z-95 Headhunter"
            skill: 8
            points: 19
            slots: [
                "Elite"
                "Missile"
            ]
        }
        {
            name: "Delta Squadron Pilot"
            faction: "Galactic Empire"
            id: 68
            ship: "TIE Defender"
            skill: 1
            points: 30
            slots: [
                "Cannon"
                "Missile"
            ]
        }
        {
            name: "Onyx Squadron Pilot"
            faction: "Galactic Empire"
            id: 69
            ship: "TIE Defender"
            skill: 3
            points: 32
            slots: [
                "Cannon"
                "Missile"
            ]
        }
        {
            name: "Colonel Vessery"
            faction: "Galactic Empire"
            id: 70
            unique: true
            ship: "TIE Defender"
            skill: 6
            points: 35
            slots: [
                "Elite"
                "Cannon"
                "Missile"
            ]
        }
        {
            name: "Rexler Brath"
            faction: "Galactic Empire"
            id: 71
            unique: true
            ship: "TIE Defender"
            skill: 8
            points: 37
            slots: [
                "Elite"
                "Cannon"
                "Missile"
            ]
        }
        {
            name: "Knave Squadron Pilot"
            faction: "Rebel Alliance"
            id: 72
            ship: "E-Wing"
            skill: 1
            points: 27
            slots: [
                "System"
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Blackmoon Squadron Pilot"
            faction: "Rebel Alliance"
            id: 73
            ship: "E-Wing"
            skill: 3
            points: 29
            slots: [
                "System"
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Etahn A'baht"
            faction: "Rebel Alliance"
            id: 74
            unique: true
            ship: "E-Wing"
            skill: 5
            points: 32
            slots: [
                "Elite"
                "System"
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Corran Horn"
            faction: "Rebel Alliance"
            id: 75
            unique: true
            ship: "E-Wing"
            skill: 8
            points: 35
            slots: [
                "Elite"
                "System"
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Sigma Squadron Pilot"
            faction: "Galactic Empire"
            id: 76
            ship: "TIE Phantom"
            skill: 3
            points: 25
            slots: [
                "System"
                "Crew"
            ]
        }
        {
            name: "Shadow Squadron Pilot"
            faction: "Galactic Empire"
            id: 77
            ship: "TIE Phantom"
            skill: 5
            points: 27
            slots: [
                "System"
                "Crew"
            ]
        }
        {
            name: '"Echo"'
            faction: "Galactic Empire"
            id: 78
            unique: true
            ship: "TIE Phantom"
            skill: 6
            points: 30
            slots: [
                "Elite"
                "System"
                "Crew"
            ]
        }
        {
            name: '"Whisper"'
            faction: "Galactic Empire"
            id: 79
            unique: true
            ship: "TIE Phantom"
            skill: 7
            points: 32
            slots: [
                "Elite"
                "System"
                "Crew"
            ]
        }
        {
            name: "CR90 Corvette (Fore)"
            faction: "Rebel Alliance"
            id: 80
            epic: true
            ship: "CR90 Corvette (Fore)"
            skill: 4
            points: 50
            slots: [
                "Crew"
                "Hardpoint"
                "Hardpoint"
                "Team"
                "Team"
                "Cargo"
            ]
        }
        {
            name: "CR90 Corvette (Aft)"
            faction: "Rebel Alliance"
            id: 81
            epic: true
            ship: "CR90 Corvette (Aft)"
            skill: 4
            points: 40
            slots: [
                "Crew"
                "Hardpoint"
                "Team"
                "Cargo"
            ]
        }
        {
            name: "Wes Janson"
            faction: "Rebel Alliance"
            id: 82
            unique: true
            ship: "X-Wing"
            skill: 8
            points: 29
            slots: [
                "Elite"
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Jek Porkins"
            faction: "Rebel Alliance"
            id: 83
            unique: true
            ship: "X-Wing"
            skill: 7
            points: 26
            slots: [
                "Elite"
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: '"Hobbie" Klivian'
            faction: "Rebel Alliance"
            id: 84
            unique: true
            ship: "X-Wing"
            skill: 5
            points: 25
            slots: [
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Tarn Mison"
            faction: "Rebel Alliance"
            id: 85
            unique: true
            ship: "X-Wing"
            skill: 3
            points: 23
            slots: [
                "Torpedo"
                "Astromech"
            ]
        }
        {
            name: "Jake Farrell"
            faction: "Rebel Alliance"
            id: 86
            unique: true
            ship: "A-Wing"
            skill: 7
            points: 24
            slots: [
                "Elite"
                "Missile"
            ]
        }
        {
            name: "Gemmer Sojan"
            faction: "Rebel Alliance"
            id: 87
            unique: true
            ship: "A-Wing"
            skill: 5
            points: 22
            slots: [
                "Missile"
            ]
        }
        {
            name: "Keyan Farlander"
            faction: "Rebel Alliance"
            id: 88
            unique: true
            ship: "B-Wing"
            skill: 7
            points: 29
            slots: [
                "Elite"
                "System"
                "Cannon"
                "Torpedo"
                "Torpedo"
            ]
        }
        {
            name: "Nera Dantels"
            faction: "Rebel Alliance"
            id: 89
            unique: true
            ship: "B-Wing"
            skill: 5
            points: 26
            slots: [
                "Elite"
                "System"
                "Cannon"
                "Torpedo"
                "Torpedo"
            ]
        }
        {
            name: "CR90 Corvette (Crippled Fore)"
            skip: true
            faction: "Rebel Alliance"
            id: 90
            ship: "CR90 Corvette (Fore)"
            skill: 4
            points: 0
            epic: true
            slots: [
                "Crew"
            ]
            ship_override:
                attack: 2
                agility: 0
                hull: 0
                shields: 0
                actions: []
        }
        {
            name: "CR90 Corvette (Crippled Aft)"
            skip: true
            faction: "Rebel Alliance"
            id: 91
            ship: "CR90 Corvette (Aft)"
            skill: 4
            points: 0
            epic: true
            slots: [
                "Cargo"
            ]
            ship_override:
                energy: 1
                agility: 0
                hull: 0
                shields: 0
                actions: []
            modifier_func: (stats) ->
                stats.maneuvers[2][1] = 0
                stats.maneuvers[2][3] = 0
                stats.maneuvers[4][2] = 0
        }
        {
            name: "Wild Space Fringer"
            faction: "Rebel Alliance"
            id: 92
            ship: "YT-2400"
            skill: 2
            points: 30
            slots: [
                "Cannon"
                "Missile"
                "Crew"
            ]
        }
        {
            name: "Eaden Vrill"
            faction: "Rebel Alliance"
            id: 93
            ship: "YT-2400"
            unique: true
            skill: 3
            points: 32
            slots: [
                "Cannon"
                "Missile"
                "Crew"
            ]
        }
        {
            name: '"Leebo"'
            faction: "Rebel Alliance"
            id: 94
            ship: "YT-2400"
            unique: true
            skill: 5
            points: 34
            slots: [
                "Elite"
                "Cannon"
                "Missile"
                "Crew"
            ]
        }
        {
            name: "Dash Rendar"
            faction: "Rebel Alliance"
            id: 95
            ship: "YT-2400"
            unique: true
            skill: 7
            points: 36
            slots: [
                "Elite"
                "Cannon"
                "Missile"
                "Crew"
            ]
        }
        {
            name: "Patrol Leader"
            faction: "Galactic Empire"
            id: 96
            ship: "VT-49 Decimator"
            skill: 3
            points: 40
            slots: [
                "Torpedo"
                "Crew"
                "Crew"
                "Crew"
                "Bomb"
            ]
        }
        {
            name: "Captain Oicunn"
            faction: "Galactic Empire"
            id: 97
            ship: "VT-49 Decimator"
            skill: 4
            points: 42
            unique: true
            slots: [
                "Elite"
                "Torpedo"
                "Crew"
                "Crew"
                "Crew"
                "Bomb"
            ]
        }
        {
            name: "Commander Kenkirk"
            faction: "Galactic Empire"
            id: 98
            ship: "VT-49 Decimator"
            skill: 6
            points: 44
            unique: true
            slots: [
                "Elite"
                "Torpedo"
                "Crew"
                "Crew"
                "Crew"
                "Bomb"
            ]
        }
        {
            name: "Rear Admiral Chiraneau"
            faction: "Galactic Empire"
            id: 99
            ship: "VT-49 Decimator"
            skill: 8
            points: 46
            unique: true
            slots: [
                "Elite"
                "Torpedo"
                "Crew"
                "Crew"
                "Crew"
                "Bomb"
            ]
        }
        {
            name: "Prince Xizor"
            faction: "Scum and Villainy"
            id: 100
            unique: true
            ship: "StarViper"
            skill: 7
            points: 31
            slots: [
                "Elite"
                "Torpedo"
            ]
        }
        {
            name: "Guri"
            faction: "Scum and Villainy"
            id: 101
            unique: true
            ship: "StarViper"
            skill: 5
            points: 30
            slots: [
                "Elite"
                "Torpedo"
            ]
        }
        {
            name: "Black Sun Vigo"
            faction: "Scum and Villainy"
            id: 102
            ship: "StarViper"
            skill: 3
            points: 27
            slots: [
                "Torpedo"
            ]
        }
        {
            name: "Black Sun Enforcer"
            faction: "Scum and Villainy"
            id: 103
            ship: "StarViper"
            skill: 1
            points: 25
            slots: [
                "Torpedo"
            ]
        }
        {
            name: "Serissu"
            faction: "Scum and Villainy"
            id: 104
            ship: "M3-A Interceptor"
            skill: 8
            points: 20
            unique: true
            slots: [
                "Elite"
            ]
        }
        {
            name: "Laetin A'shera"
            faction: "Scum and Villainy"
            id: 105
            ship: "M3-A Interceptor"
            skill: 6
            points: 18
            unique: true
            slots: [ ]
        }
        {
            name: "Tansarii Point Veteran"
            faction: "Scum and Villainy"
            id: 106
            ship: "M3-A Interceptor"
            skill: 5
            points: 17
            slots: [
                "Elite"
            ]
        }
        {
            name: "Cartel Spacer"
            faction: "Scum and Villainy"
            id: 107
            ship: "M3-A Interceptor"
            skill: 2
            points: 14
            slots: [ ]
        }
        {
            name: "IG-88A"
            faction: "Scum and Villainy"
            id: 108
            unique: true
            ship: "Aggressor"
            skill: 6
            points: 36
            slots: [
                "Elite"
                "System"
                "Cannon"
                "Cannon"
                "Bomb"
                "Illicit"
            ]
        }
        {
            name: "IG-88B"
            faction: "Scum and Villainy"
            id: 109
            unique: true
            ship: "Aggressor"
            skill: 6
            points: 36
            slots: [
                "Elite"
                "System"
                "Cannon"
                "Cannon"
                "Bomb"
                "Illicit"
            ]
        }
        {
            name: "IG-88C"
            faction: "Scum and Villainy"
            id: 110
            unique: true
            ship: "Aggressor"
            skill: 6
            points: 36
            slots: [
                "Elite"
                "System"
                "Cannon"
                "Cannon"
                "Bomb"
                "Illicit"
            ]
        }
        {
            name: "IG-88D"
            faction: "Scum and Villainy"
            id: 111
            unique: true
            ship: "Aggressor"
            skill: 6
            points: 36
            slots: [
                "Elite"
                "System"
                "Cannon"
                "Cannon"
                "Bomb"
                "Illicit"
            ]
        }
        {
            name: "N'Dru Suhlak"
            unique: true
            faction: "Scum and Villainy"
            id: 112
            ship: "Z-95 Headhunter"
            skill: 7
            points: 17
            slots: [
                "Elite"
                "Missile"
                "Illicit"
            ]
        }
        {
            name: "Kaa'to Leeachos"
            unique: true
            faction: "Scum and Villainy"
            id: 113
            ship: "Z-95 Headhunter"
            skill: 5
            points: 15
            slots: [
                "Elite"
                "Missile"
                "Illicit"
            ]
        }
        {
            name: "Black Sun Soldier"
            faction: "Scum and Villainy"
            id: 114
            ship: "Z-95 Headhunter"
            skill: 3
            points: 13
            slots: [
                "Missile"
                "Illicit"
            ]
        }
        {
            name: "Binayre Pirate"
            faction: "Scum and Villainy"
            id: 115
            ship: "Z-95 Headhunter"
            skill: 1
            points: 12
            slots: [
                "Missile"
                "Illicit"
            ]
        }
        {
            name: "Boba Fett (Scum)"
            canonical_name: 'Boba Fett'.canonicalize()
            faction: "Scum and Villainy"
            id: 116
            ship: "Firespray-31"
            skill: 8
            points: 39
            unique: true
            slots: [
                "Elite"
                "Cannon"
                "Bomb"
                "Crew"
                "Missile"
                "Illicit"
            ]
        }
        {
            name: "Kath Scarlet (Scum)"
            canonical_name: 'Kath Scarlet'.canonicalize()
            unique: true
            faction: "Scum and Villainy"
            id: 117
            ship: "Firespray-31"
            skill: 7
            points: 38
            slots: [
                "Elite"
                "Cannon"
                "Bomb"
                "Crew"
                "Missile"
                "Illicit"
            ]
        }
        {
            name: "Emon Azzameen"
            unique: true
            faction: "Scum and Villainy"
            id: 118
            ship: "Firespray-31"
            skill: 6
            points: 36
            slots: [
                "Cannon"
                "Bomb"
                "Crew"
                "Missile"
                "Illicit"
            ]
        }
        {
            name: "Mandalorian Mercenary"
            faction: "Scum and Villainy"
            id: 119
            ship: "Firespray-31"
            skill: 5
            points: 35
            slots: [
                "Elite"
                "Cannon"
                "Bomb"
                "Crew"
                "Missile"
                "Illicit"
            ]
        }
        {
            name: "Kavil"
            unique: true
            faction: "Scum and Villainy"
            id: 120
            ship: "Y-Wing"
            skill: 7
            points: 24
            slots: [
                "Elite"
                "Turret"
                "Torpedo"
                "Torpedo"
                "Salvaged Astromech"
            ]
        }
        {
            name: "Drea Renthal"
            unique: true
            faction: "Scum and Villainy"
            id: 121
            ship: "Y-Wing"
            skill: 5
            points: 22
            slots: [
                "Turret"
                "Torpedo"
                "Torpedo"
                "Salvaged Astromech"
            ]
        }
        {
            name: "Hired Gun"
            faction: "Scum and Villainy"
            id: 122
            ship: "Y-Wing"
            skill: 4
            points: 20
            slots: [
                "Turret"
                "Torpedo"
                "Torpedo"
                "Salvaged Astromech"
            ]
        }
        {
            name: "Syndicate Thug"
            faction: "Scum and Villainy"
            id: 123
            ship: "Y-Wing"
            skill: 2
            points: 18
            slots: [
                "Turret"
                "Torpedo"
                "Torpedo"
                "Salvaged Astromech"
            ]
        }
        {
            name: "Dace Bonearm"
            unique: true
            faction: "Scum and Villainy"
            id: 124
            ship: "HWK-290"
            skill: 7
            points: 23
            slots: [
                "Elite"
                "Turret"
                "Crew"
                "Illicit"
            ]
        }
        {
            name: "Palob Godalhi"
            unique: true
            faction: "Scum and Villainy"
            id: 125
            ship: "HWK-290"
            skill: 5
            points: 20
            slots: [
                "Elite"
                "Turret"
                "Crew"
                "Illicit"
            ]
        }
        {
            name: "Torkil Mux"
            unique: true
            faction: "Scum and Villainy"
            id: 126
            ship: "HWK-290"
            skill: 3
            points: 19
            slots: [
                "Turret"
                "Crew"
                "Illicit"
            ]
        }
        {
            name: "Spice Runner"
            faction: "Scum and Villainy"
            id: 127
            ship: "HWK-290"
            skill: 1
            points: 16
            slots: [
                "Turret"
                "Crew"
                "Illicit"
            ]
        }
        {
            name: "Commander Alozen"
            faction: "Galactic Empire"
            id: 128
            ship: "TIE Advanced"
            unique: true
            skill: 5
            points: 25
            slots: [
                "Elite"
                "Missile"
            ]
        }
        {
            name: "Raider-class Corvette (Fore)"
            faction: "Galactic Empire"
            id: 129
            ship: "Raider-class Corvette (Fore)"
            skill: 4
            points: 50
            epic: true
            slots: [
                "Hardpoint"
                "Team"
                "Cargo"
            ]
        }
        {
            name: "Raider-class Corvette (Aft)"
            faction: "Galactic Empire"
            id: 130
            ship: "Raider-class Corvette (Aft)"
            skill: 4
            points: 50
            epic: true
            slots: [
                "Crew"
                "Crew"
                "Hardpoint"
                "Hardpoint"
                "Team"
                "Team"
                "Cargo"
            ]
        }
        {
            name: "Bossk"
            faction: "Scum and Villainy"
            id: 131
            ship: "YV-666"
            unique: true
            skill: 7
            points: 35
            slots: [
                "Elite"
                "Cannon"
                "Missile"
                "Crew"
                "Crew"
                "Crew"
                "Illicit"
            ]
        }
        {
            name: "Moralo Eval"
            faction: "Scum and Villainy"
            id: 132
            ship: "YV-666"
            unique: true
            skill: 6
            points: 34
            slots: [
                "Cannon"
                "Missile"
                "Crew"
                "Crew"
                "Crew"
                "Illicit"
            ]
        }
        {
            name: "Latts Razzi"
            faction: "Scum and Villainy"
            id: 133
            ship: "YV-666"
            unique: true
            skill: 5
            points: 33
            slots: [
                "Cannon"
                "Missile"
                "Crew"
                "Crew"
                "Crew"
                "Illicit"
            ]
        }
        {
            name: "Trandoshan Slaver"
            faction: "Scum and Villainy"
            id: 134
            ship: "YV-666"
            skill: 2
            points: 29
            slots: [
                "Cannon"
                "Missile"
                "Crew"
                "Crew"
                "Crew"
                "Illicit"
            ]
        }
        {
            name: "Talonbane Cobra"
            unique: true
            id: 135
            faction: "Scum and Villainy"
            ship: "Kihraxz Fighter"
            skill: 9
            slots: [
                "Elite"
                "Missile"
                "Illicit"
            ]
            points: 28
        }
        {
            name: "Graz the Hunter"
            unique: true
            id: 136
            faction: "Scum and Villainy"
            ship: "Kihraxz Fighter"
            skill: 6
            slots: [
                "Missile"
                "Illicit"
            ]
            points: 25
        }
        {
            name: "Black Sun Ace"
            faction: "Scum and Villainy"
            id: 137
            ship: "Kihraxz Fighter"
            skill: 5
            slots: [
                "Elite"
                "Missile"
                "Illicit"
            ]
            points: 23
        }
        {
            name: "Cartel Marauder"
            faction: "Scum and Villainy"
            id: 138
            ship: "Kihraxz Fighter"
            skill: 2
            slots: [
                "Missile"
                "Illicit"
            ]
            points: 20
        }
        {
            name: "Miranda Doni"
            unique: true
            id: 139
            faction: "Rebel Alliance"
            ship: "K-Wing"
            skill: 8
            slots: [
                "Turret"
                "Torpedo"
                "Torpedo"
                "Missile"
                "Crew"
                "Bomb"
                "Bomb"
            ]
            points: 29
        }
        {
            name: "Esege Tuketu"
            unique: true
            id: 140
            faction: "Rebel Alliance"
            ship: "K-Wing"
            skill: 6
            slots: [
                "Turret"
                "Torpedo"
                "Torpedo"
                "Missile"
                "Crew"
                "Bomb"
                "Bomb"
            ]
            points: 28
        }
        {
            name: "Guardian Squadron Pilot"
            faction: "Rebel Alliance"
            id: 141
            ship: "K-Wing"
            skill: 4
            slots: [
                "Turret"
                "Torpedo"
                "Torpedo"
                "Missile"
                "Crew"
                "Bomb"
                "Bomb"
            ]
            points: 25
        }
        {
            name: "Warden Squadron Pilot"
            faction: "Rebel Alliance"
            id: 142
            ship: "K-Wing"
            skill: 2
            slots: [
                "Turret"
                "Torpedo"
                "Torpedo"
                "Missile"
                "Crew"
                "Bomb"
                "Bomb"
            ]
            points: 23
        }
        {
            name: '"Redline"'
            unique: true
            id: 143
            faction: "Galactic Empire"
            ship: "TIE Punisher"
            skill: 7
            slots: [
                "System"
                "Torpedo"
                "Torpedo"
                "Missile"
                "Missile"
                "Bomb"
                "Bomb"
            ]
            points: 27
        }
        {
            name: '"Deathrain"'
            unique: true
            id: 144
            faction: "Galactic Empire"
            ship: "TIE Punisher"
            skill: 6
            slots: [
                "System"
                "Torpedo"
                "Torpedo"
                "Missile"
                "Missile"
                "Bomb"
                "Bomb"
            ]
            points: 26
        }
        {
            name: 'Black Eight Squadron Pilot'
            canonical_name: 'Black Eight Sq. Pilot'.canonicalize()
            faction: "Galactic Empire"
            id: 145
            ship: "TIE Punisher"
            skill: 4
            slots: [
                "System"
                "Torpedo"
                "Torpedo"
                "Missile"
                "Missile"
                "Bomb"
                "Bomb"
            ]
            points: 23
        }
        {
            name: 'Cutlass Squadron Pilot'
            faction: "Galactic Empire"
            id: 146
            ship: "TIE Punisher"
            skill: 2
            slots: [
                "System"
                "Torpedo"
                "Torpedo"
                "Missile"
                "Missile"
                "Bomb"
                "Bomb"
            ]
            points: 21
        }
        {
            name: "Juno Eclipse"
            id: 147
            faction: "Galactic Empire"
            ship: "TIE Advanced"
            unique: true
            skill: 8
            points: 28
            slots: [
                "Elite"
                "Missile"
            ]
        }
        {
            name: "Zertik Strom"
            id: 148
            faction: "Galactic Empire"
            ship: "TIE Advanced"
            unique: true
            skill: 6
            points: 26
            slots: [
                "Elite"
                "Missile"
            ]
        }
        {
            name: "Lieutenant Colzet"
            id: 149
            faction: "Galactic Empire"
            ship: "TIE Advanced"
            unique: true
            skill: 3
            points: 23
            slots: [
                "Missile"
            ]
        }
        {
            name: "Gozanti-class Cruiser"
            id: 150
            faction: "Galactic Empire"
            ship: "Gozanti-class Cruiser"
            skill: 2
            slots: [
                'Crew'
                'Crew'
                'Hardpoint'
                'Team'
                'Cargo'
                'Cargo'
            ]
            points: 40
        }
        {
            name: '"Scourge"'
            id: 151
            unique: true
            faction: "Galactic Empire"
            ship: "TIE Fighter"
            skill: 7
            slots: [
                'Elite'
            ]
            points: 17
        }
        {
            name: '"Youngster"'
            id: 152
            unique: true
            faction: "Galactic Empire"
            ship: "TIE Fighter"
            skill: 6
            slots: [
                'Elite'
                'ActEPT'
            ]
            points: 15
        }
        {
            name: '"Wampa"'
            id: 153
            unique: true
            faction: "Galactic Empire"
            ship: "TIE Fighter"
            skill: 4
            slots: []
            points: 14
        }
        {
            name: '"Chaser"'
            id: 154
            unique: true
            faction: "Galactic Empire"
            ship: "TIE Fighter"
            skill: 3
            slots: []
            points: 14
        }
        {
            name: "Hera Syndulla"
            id: 155
            unique: true
            faction: "Rebel Alliance"
            ship: "VCX-100"
            skill: 7
            slots: [
                'System'
                'Turret'
                'Torpedo'
                'Torpedo'
                'Crew'
                'Crew'
            ]
            points: 40
        }
        {
            name: "Kanan Jarrus"
            id: 156
            unique: true
            faction: "Rebel Alliance"
            ship: "VCX-100"
            skill: 5
            slots: [
                'System'
                'Turret'
                'Torpedo'
                'Torpedo'
                'Crew'
                'Crew'
            ]
            points: 38
        }
        {
            name: '"Chopper"'
            id: 157
            unique: true
            faction: "Rebel Alliance"
            ship: "VCX-100"
            skill: 4
            slots: [
                'System'
                'Turret'
                'Torpedo'
                'Torpedo'
                'Crew'
                'Crew'
            ]
            points: 37
        }
        {
            name: 'Lothal Rebel'
            id: 158
            faction: "Rebel Alliance"
            ship: "VCX-100"
            skill: 3
            slots: [
                'System'
                'Turret'
                'Torpedo'
                'Torpedo'
                'Crew'
                'Crew'
            ]
            points: 35
        }
        {
            name: 'Hera Syndulla (Attack Shuttle)'
            id: 159
            canonical_name: 'Hera Syndulla'.canonicalize()
            unique: true
            faction: "Rebel Alliance"
            ship: "Attack Shuttle"
            skill: 7
            slots: [
                'Elite'
                'Turret'
                'Crew'
            ]
            points: 22
        }
        {
            name: 'Sabine Wren'
            id: 160
            unique: true
            faction: "Rebel Alliance"
            ship: "Attack Shuttle"
            skill: 5
            slots: [
                'Elite'
                'Turret'
                'Crew'
            ]
            points: 21
        }
        {
            name: 'Ezra Bridger'
            id: 161
            unique: true
            faction: "Rebel Alliance"
            ship: "Attack Shuttle"
            skill: 4
            slots: [
                'Elite'
                'Turret'
                'Crew'
            ]
            points: 20
        }
        {
            name: '"Zeb" Orrelios'
            id: 162
            unique: true
            faction: "Rebel Alliance"
            ship: "Attack Shuttle"
            skill: 3
            slots: [
                'Turret'
                'Crew'
            ]
            points: 18
        }
        {
            name: "The Inquisitor"
            id: 163
            unique: true
            faction: "Galactic Empire"
            ship: "TIE Advanced Prototype"
            skill: 8
            slots: [
                'Elite'
                'Missile'
            ]
            points: 25
        }
        {
            name: "Valen Rudor"
            id: 164
            unique: true
            faction: "Galactic Empire"
            ship: "TIE Advanced Prototype"
            skill: 6
            slots: [
                'Elite'
                'Missile'
            ]
            points: 22
        }
        {
            name: "Baron of the Empire"
            id: 165
            faction: "Galactic Empire"
            ship: "TIE Advanced Prototype"
            skill: 4
            slots: [
                'Elite'
                'Missile'
            ]
            points: 19
        }
        {
            name: "Sienar Test Pilot"
            id: 166
            faction: "Galactic Empire"
            ship: "TIE Advanced Prototype"
            skill: 2
            slots: [
                'Missile'
            ]
            points: 16
        }
        {
            name: "Zuckuss"
            id: 167
            unique: true
            faction: "Scum and Villainy"
            ship: "G-1A Starfighter"
            skill: 7
            slots: [
                'Elite'
                'Crew'
                'System'
                'Illicit'
            ]
            points: 28
        }
        {
            name: "4-LOM"
            id: 168
            unique: true
            faction: "Scum and Villainy"
            ship: "G-1A Starfighter"
            skill: 6
            slots: [
                'Elite'
                'Crew'
                'System'
                'Illicit'
            ]
            points: 27
        }
        {
            name: "Gand Findsman"
            id: 169
            faction: "Scum and Villainy"
            ship: "G-1A Starfighter"
            skill: 5
            slots: [
                'Elite'
                'Crew'
                'System'
                'Illicit'
            ]
            points: 25
        }
        {
            name: "Ruthless Freelancer"
            id: 170
            faction: "Scum and Villainy"
            ship: "G-1A Starfighter"
            skill: 3
            slots: [
                'Crew'
                'System'
                'Illicit'
            ]
            points: 23
        }
        {
            name: "Dengar"
            id: 171
            unique: true
            faction: "Scum and Villainy"
            ship: "JumpMaster 5000"
            skill: 9
            slots: [
                'Elite'
                'Torpedo'
                'Torpedo'
                'Crew'
                'Salvaged Astromech'
                'Illicit'
            ]
            points: 33
        }
        {
            name: "Tel Trevura"
            id: 172
            unique: true
            faction: "Scum and Villainy"
            ship: "JumpMaster 5000"
            skill: 7
            slots: [
                'Elite'
                'Torpedo'
                'Torpedo'
                'Crew'
                'Salvaged Astromech'
                'Illicit'
            ]
            points: 30
        }
        {
            name: "Manaroo"
            id: 173
            unique: true
            faction: "Scum and Villainy"
            ship: "JumpMaster 5000"
            skill: 4
            slots: [
                'Elite'
                'Torpedo'
                'Torpedo'
                'Crew'
                'Salvaged Astromech'
                'Illicit'
            ]
            points: 27
        }
        {
            name: "Contracted Scout"
            id: 174
            faction: "Scum and Villainy"
            ship: "JumpMaster 5000"
            skill: 3
            slots: [
                'Elite'
                'Torpedo'
                'Torpedo'
                'Crew'
                'Salvaged Astromech'
                'Illicit'
            ]
            points: 25
        }
        # T-70
        {
            name: "Poe Dameron"
            id: 175
            unique: true
            faction: "Resistance"
            ship: "T-70 X-Wing"
            skill: 8
            slots: [
                'Elite'
                'Torpedo'
                'Astromech'
                'Tech'
            ]
            points: 31
        }
        {
            name: '"Blue Ace"'
            id: 176
            unique: true
            faction: "Resistance"
            ship: "T-70 X-Wing"
            skill: 5
            slots: [
                'Torpedo'
                'Astromech'
                'Tech'
            ]
            points: 27
        }
        {
            name: "Red Squadron Veteran"
            id: 177
            faction: "Resistance"
            ship: "T-70 X-Wing"
            skill: 4
            slots: [
                'Elite'
                'Torpedo'
                'Astromech'
                'Tech'
            ]
            points: 26
        }
        {
            name: "Blue Squadron Novice"
            id: 178
            faction: "Resistance"
            ship: "T-70 X-Wing"
            skill: 2
            slots: [
                'Torpedo'
                'Astromech'
                'Tech'
            ]
            points: 24
        }
        # TIE/fo
        {
            name: '"Omega Ace"'
            id: 179
            unique: true
            faction: "First Order"
            ship: "TIE/fo Fighter"
            skill: 7
            slots: [
                'Elite'
                'Tech'
            ]
            points: 20
        }
        {
            name: '"Epsilon Leader"'
            id: 180
            unique: true
            faction: "First Order"
            ship: "TIE/fo Fighter"
            skill: 6
            slots: [
                'Tech'
            ]
            points: 19
        }
        {
            name: '"Zeta Ace"'
            id: 181
            unique: true
            faction: "First Order"
            ship: "TIE/fo Fighter"
            skill: 5
            slots: [
                'Elite'
                'Tech'
            ]
            points: 18
        }
        {
            name: "Omega Squadron Pilot"
            id: 182
            faction: "First Order"
            ship: "TIE/fo Fighter"
            skill: 4
            slots: [
                'Elite'
                'Tech'
            ]
            points: 17
        }
        {
            name: "Zeta Squadron Pilot"
            id: 183
            faction: "First Order"
            ship: "TIE/fo Fighter"
            skill: 3
            slots: [
                'Tech'
            ]
            points: 16
        }
        {
            name: "Epsilon Squadron Pilot"
            id: 184
            faction: "First Order"
            ship: "TIE/fo Fighter"
            skill: 1
            slots: [
                'Tech'
            ]
            points: 15
        }
        {
            name: "Ello Asty"
            id: 185
            unique: true
            faction: "Resistance"
            ship: "T-70 X-Wing"
            skill: 7
            slots: [
                'Elite'
                'Torpedo'
                'Astromech'
                'Tech'
            ]
            points: 30
        }
        {
            name: '"Red Ace"'
            id: 186
            unique: true
            faction: "Resistance"
            ship: "T-70 X-Wing"
            skill: 6
            slots: [
                'Torpedo'
                'Astromech'
                'Tech'
            ]
            points: 29
        }
        {
            name: '"Omega Leader"'
            id: 187
            unique: true
            faction: "First Order"
            ship: "TIE/fo Fighter"
            skill: 8
            slots: [
                'Elite'
                'Tech'
            ]
            points: 21
        }
        {
            name: '"Zeta Leader"'
            id: 188
            unique: true
            faction: "First Order"
            ship: "TIE/fo Fighter"
            skill: 7
            slots: [
                'Elite'
                'Tech'
            ]
            points: 20
        }
        {
            name: '"Epsilon Ace"'
            id: 189
            unique: true
            faction: "First Order"
            ship: "TIE/fo Fighter"
            skill: 4
            slots: [
                'Tech'
            ]
            points: 17
        }
        {
            name: "Tomax Bren"
            id: 190
            unique: true
            faction: "Galactic Empire"
            ship: "TIE Bomber"
            skill: 8
            slots: [
                'Elite'
                'DiscEPT'
                'Torpedo'
                'Torpedo'
                'Missile'
                'Missile'
                'Bomb'
            ]
            points: 24
        }
        {
            name: "Gamma Squadron Veteran"
            id: 191
            faction: "Galactic Empire"
            ship: "TIE Bomber"
            skill: 5
            slots: [
                'Elite'
                'Torpedo'
                'Torpedo'
                'Missile'
                'Missile'
                'Bomb'
            ]
            points: 19
        }
        {
            name: '"Deathfire"'
            id: 192
            unique: true
            faction: "Galactic Empire"
            ship: "TIE Bomber"
            skill: 3
            slots: [
                'Torpedo'
                'Torpedo'
                'Missile'
                'Missile'
                'Bomb'
            ]
            points: 17
        }
        {
            name: "Maarek Stele (TIE Defender)"
            canonical_name: 'maarekstele'
            id: 193
            unique: true
            faction: "Galactic Empire"
            ship: "TIE Defender"
            skill: 7
            slots: [
                'Elite'
                'Cannon'
                'Missile'
            ]
            points: 35
        }
        {
            name: "Glaive Squadron Pilot"
            id: 194
            faction: "Galactic Empire"
            ship: "TIE Defender"
            skill: 6
            slots: [
                'Elite'
                'Cannon'
                'Missile'
            ]
            points: 34
        }
        {
            name: "Countess Ryad"
            id: 195
            unique: true
            faction: "Galactic Empire"
            ship: "TIE Defender"
            skill: 5
            slots: [
                'Elite'
                'Cannon'
                'Missile'
            ]
            points: 34
        }
        {
            name: "Poe Dameron (PS9)"
            canonical_name: "poedameron-swx57"
            id: 196
            unique: true
            faction: "Resistance"
            ship: "T-70 X-Wing"
            skill: 9
            slots: [
                'Elite'
                'Torpedo'
                'Astromech'
                'Tech'
            ]
            points: 33
        }
        {
            name: 'Nien Nunb'
            id: 197
            unique: true
            faction: "Resistance"
            ship: "T-70 X-Wing"
            skill: 7
            slots: [
                'Elite'
                'Torpedo'
                'Astromech'
                'Tech'
            ]
            points: 29
        }
        {
            name: '''"Snap" Wexley'''
            id: 198
            unique: true
            faction: "Resistance"
            ship: "T-70 X-Wing"
            skill: 6
            slots: [
                'Elite'
                'Torpedo'
                'Astromech'
                'Tech'
            ]
            points: 28
        }
        {
            name: 'Jess Pava'
            id: 199
            unique: true
            faction: "Resistance"
            ship: "T-70 X-Wing"
            skill: 3
            slots: [
                'Torpedo'
                'Astromech'
                'Tech'
            ]
            points: 25
        }
        {
            name: "Han Solo (TFA)"
            canonical_name: "hansolo-swx57"
            id: 200
            unique: true
            faction: "Resistance"
            ship: "YT-1300"
            skill: 9
            points: 46
            slots: [
                "Elite"
                "Missile"
                "Crew"
                "Crew"
            ]
            ship_override:
                attack: 3
                agility: 1
                hull: 8
                shields: 5
        }
        {
            name: "Rey"
            id: 201
            unique: true
            faction: "Resistance"
            ship: "YT-1300"
            skill: 8
            points: 45
            slots: [
                "Elite"
                "Missile"
                "Crew"
                "Crew"
            ]
            ship_override:
                attack: 3
                agility: 1
                hull: 8
                shields: 5
        }
        {
            name: "Chewbacca (TFA)"
            canonical_name: "chewbacca-swx57"
            id: 202
            unique: true
            faction: "Resistance"
            ship: "YT-1300"
            skill: 5
            points: 42
            slots: [
                "Elite"
                "Missile"
                "Crew"
                "Crew"
            ]
            ship_override:
                attack: 3
                agility: 1
                hull: 8
                shields: 5
        }
        {
            name: "Resistance Sympathizer"
            id: 203
            faction: "Resistance"
            ship: "YT-1300"
            skill: 3
            points: 38
            slots: [
                "Missile"
                "Crew"
                "Crew"
            ]
            ship_override:
                attack: 3
                agility: 1
                hull: 8
                shields: 5
        }
        {
            name: 'Norra Wexley'
            id: 204
            unique: true
            faction: 'Rebel Alliance'
            ship: 'ARC-170'
            skill: 7
            slots: [
                'Elite'
                'Torpedo'
                'Crew'
                'Astromech'
            ]
            points: 29
        }
        {
            name: 'Shara Bey'
            id: 205
            unique: true
            faction: 'Rebel Alliance'
            ship: 'ARC-170'
            skill: 6
            slots: [
                'Elite'
                'Torpedo'
                'Crew'
                'Astromech'
            ]
            points: 28
        }
        {
            name: 'Thane Kyrell'
            id: 206
            unique: true
            faction: 'Rebel Alliance'
            ship: 'ARC-170'
            skill: 4
            slots: [
                'Torpedo'
                'Crew'
                'Astromech'
            ]
            points: 26
        }
        {
            name: 'Braylen Stramm'
            id: 207
            unique: true
            faction: 'Rebel Alliance'
            ship: 'ARC-170'
            skill: 3
            slots: [
                'Torpedo'
                'Crew'
                'Astromech'
            ]
            points: 25
        }
        {
            name: '"Quickdraw"'
            id: 208
            unique: true
            faction: 'Galactic Empire'
            ship: 'TIE/sf Fighter'
            skill: 9
            slots: [
                'Elite'
                'System'
                'Missile'
                'Tech'
            ]
            points: 29
        }
        {
            name: '"Backdraft"'
            id: 209
            unique: true
            faction: 'Galactic Empire'
            ship: 'TIE/sf Fighter'
            skill: 7
            slots: [
                'Elite'
                'System'
                'Missile'
                'Tech'
            ]
            points: 27
        }
        {
            name: 'Omega Specialist'
            id: 210
            faction: 'Galactic Empire'
            ship: 'TIE/sf Fighter'
            skill: 5
            slots: [
                'Elite'
                'System'
                'Missile'
                'Tech'
            ]
            points: 25
        }
        {
            name: 'Zeta Specialist'
            id: 211
            faction: 'Galactic Empire'
            ship: 'TIE/sf Fighter'
            skill: 3
            slots: [
                'System'
                'Missile'
                'Tech'
            ]
            points: 23
        }
        {
            name: 'Fenn Rau'
            id: 212
            unique: true
            faction: 'Scum and Villainy'
            ship: 'Protectorate Starfighter'
            skill: 9
            slots: [
                'Elite'
                'Torpedo'
            ]
            points: 28
        }
        {
            name: 'Old Teroch'
            id: 213
            unique: true
            faction: 'Scum and Villainy'
            ship: 'Protectorate Starfighter'
            skill: 7
            slots: [
                'Elite'
                'Torpedo'
            ]
            points: 26
        }
        {
            name: 'Kad Solus'
            id: 214
            unique: true
            faction: 'Scum and Villainy'
            ship: 'Protectorate Starfighter'
            skill: 6
            slots: [
                'Elite'
                'Torpedo'
            ]
            points: 25
        }
        {
            name: 'Concord Dawn Ace'
            id: 215
            faction: 'Scum and Villainy'
            ship: 'Protectorate Starfighter'
            skill: 5
            slots: [
                'Elite'
                'Torpedo'
            ]
            points: 23
        }
        {
            name: 'Concord Dawn Veteran'
            id: 216
            faction: 'Scum and Villainy'
            ship: 'Protectorate Starfighter'
            skill: 3
            slots: [
                'Elite'
                'Torpedo'
            ]
            points: 22
        }
        {
            name: 'Zealous Recruit'
            id: 217
            faction: 'Scum and Villainy'
            ship: 'Protectorate Starfighter'
            skill: 1
            slots: [
                'Torpedo'
            ]
            points: 20
        }
        {
            name: 'Ketsu Onyo'
            id: 218
            unique: true
            faction: 'Scum and Villainy'
            ship: 'Lancer-class Pursuit Craft'
            skill: 7
            slots: [
                'Elite'
                'Crew'
                'Illicit'
                'Illicit'
            ]
            points: 38
        }
        {
            name: 'Asajj Ventress'
            id: 219
            unique: true
            faction: 'Scum and Villainy'
            ship: 'Lancer-class Pursuit Craft'
            skill: 6
            slots: [
                'Elite'
                'Crew'
                'Illicit'
                'Illicit'
            ]
            points: 37
        }
        {
            name: 'Sabine Wren (Scum)'
            canonical_name: "sabinewren"
            id: 220
            unique: true
            faction: 'Scum and Villainy'
            ship: 'Lancer-class Pursuit Craft'
            skill: 5
            slots: [
                'Crew'
                'Illicit'
                'Illicit'
            ]
            points: 35
        }
        {
            name: 'Shadowport Hunter'
            id: 221
            faction: 'Scum and Villainy'
            ship: 'Lancer-class Pursuit Craft'
            skill: 2
            slots: [
                'Crew'
                'Illicit'
                'Illicit'
            ]
            points: 33
        }
        {
            name: 'Ahsoka Tano'
            id: 222
            unique: true
            faction: 'Rebel Alliance'
            ship: 'TIE Fighter'
            skill: 7
            slots: [
                'Elite'
            ]
            points: 17
        }
        {
            name: 'Sabine Wren (TIE Fighter)'
            id: 223
            canonical_name: "sabinewren"
            unique: true
            faction: 'Rebel Alliance'
            ship: 'TIE Fighter'
            skill: 5
            slots: [
                'Elite'
            ]
            points: 15
        }
        {
            name: 'Captain Rex'
            id: 224
            unique: true
            faction: 'Rebel Alliance'
            ship: 'TIE Fighter'
            skill: 4
            slots: []
            points: 14
            applies_condition: 'Suppressive Fire'.canonicalize()
        }
        {
            name: '"Zeb" Orrelios (TIE Fighter)'
            id: 225
            canonical_name: '"Zeb" Orrelios'.canonicalize()
            unique: true
            faction: 'Rebel Alliance'
            ship: 'TIE Fighter'
            skill: 3
            slots: []
            points: 13
        }
        {
            name: 'Kylo Ren'
            id: 226
            unique: true
            faction: 'First Order'
            ship: 'Upsilon-class Shuttle'
            skill: 6
            slots: [
                'Elite'
                'System'
                'Crew'
                'Crew'
                'Tech'
                'Tech'
            ]
            points: 34
            applies_condition: '''I'll Show You the Dark Side'''.canonicalize()
        }
        {
            name: 'Major Stridan'
            id: 227
            unique: true
            faction: 'First Order'
            ship: 'Upsilon-class Shuttle'
            skill: 4
            slots: [
                'System'
                'Crew'
                'Crew'
                'Tech'
                'Tech'
            ]
            points: 32
        }
        {
            name: 'Lieutenant Dormitz'
            id: 228
            unique: true
            faction: 'First Order'
            ship: 'Upsilon-class Shuttle'
            skill: 3
            slots: [
                'System'
                'Crew'
                'Crew'
                'Tech'
                'Tech'
            ]
            points: 31
        }
        {
            name: 'Starkiller Base Pilot'
            id: 229
            faction: 'First Order'
            ship: 'Upsilon-class Shuttle'
            skill: 2
            slots: [
                'System'
                'Crew'
                'Crew'
                'Tech'
                'Tech'
            ]
            points: 30
        }
        {
            name: 'Constable Zuvio'
            id: 230
            unique: true
            faction: 'Scum and Villainy'
            ship: 'Quadjumper'
            skill: 7
            slots: [
                'Elite'
                'Crew'
                'Bomb'
                'Tech'
                'Illicit'
            ]
            points: 19
        }
        {
            name: 'Sarco Plank'
            id: 231
            unique: true
            faction: 'Scum and Villainy'
            ship: 'Quadjumper'
            skill: 5
            slots: [
                'Elite'
                'Crew'
                'Bomb'
                'Tech'
                'Illicit'
            ]
            points: 18
        }
        {
            name: 'Unkar Plutt'
            id: 232
            unique: true
            faction: 'Scum and Villainy'
            ship: 'Quadjumper'
            skill: 3
            slots: [
                'Crew'
                'Bomb'
                'Tech'
                'Illicit'
            ]
            points: 17
        }
        {
            name: 'Jakku Gunrunner'
            id: 233
            faction: 'Scum and Villainy'
            ship: 'Quadjumper'
            skill: 1
            slots: [
                'Crew'
                'Bomb'
                'Tech'
                'Illicit'
            ]
            points: 15
        }
        {
            name: 'Cassian Andor'
            id: 234
            unique: true
            faction: 'Rebel Alliance'
            ship: 'U-Wing'
            skill: 6
            slots: [
                'Elite'
                'System'
                'Torpedo'
                'Crew'
                'Crew'
            ]
            points: 27
        }
        {
            name: 'Bodhi Rook'
            id: 235
            unique: true
            faction: 'Rebel Alliance'
            ship: 'U-Wing'
            skill: 4
            slots: [
                'System'
                'Torpedo'
                'Crew'
                'Crew'
            ]
            points: 25
        }
        {
            name: 'Heff Tobber'
            id: 236
            unique: true
            faction: 'Rebel Alliance'
            ship: 'U-Wing'
            skill: 3
            slots: [
                'System'
                'Torpedo'
                'Crew'
                'Crew'
            ]
            points: 24
        }
        {
            name: 'Blue Squadron Pathfinder'
            id: 237
            faction: 'Rebel Alliance'
            ship: 'U-Wing'
            skill: 2
            slots: [
                'System'
                'Torpedo'
                'Crew'
                'Crew'
            ]
            points: 23
        }
        {
            name: '"Duchess"'
            id: 238
            unique: true
            faction: 'Galactic Empire'
            ship: 'TIE Striker'
            skill: 8
            slots: [
                'Elite'
            ]
            points: 23
        }
        {
            name: '"Pure Sabacc"'
            id: 239
            unique: true
            faction: 'Galactic Empire'
            ship: 'TIE Striker'
            skill: 6
            slots: [
                'Elite'
            ]
            points: 22
        }
        {
            name: '"Countdown"'
            id: 240
            unique: true
            faction: 'Galactic Empire'
            ship: 'TIE Striker'
            skill: 5
            slots: [
            ]
            points: 20
        }
        {
            name: 'Black Squadron Scout'
            id: 241
            faction: 'Galactic Empire'
            ship: 'TIE Striker'
            skill: 4
            slots: [
                'Elite'
            ]
            points: 20
        }
        {
            name: 'Scarif Defender'
            id: 242
            faction: 'Galactic Empire'
            ship: 'TIE Striker'
            skill: 3
            slots: [
            ]
            points: 18
        }
        {
            name: 'Imperial Trainee'
            id: 243
            faction: 'Galactic Empire'
            ship: 'TIE Striker'
            skill: 1
            slots: [
            ]
            points: 17
        }
        {
            name: 'C-ROC Cruiser'
            id: 244
            faction: 'Scum and Villainy'
            ship: 'C-ROC Cruiser'
            skill: 1
            slots: [
                'Crew'
                'Crew'
                'Hardpoint'
                'Team'
                'Cargo'
                'Cargo'
                'Cargo'
            ]
            points: 35
        }
        {
            name: 'Genesis Red'
            id: 245
            unique: true
            faction: 'Scum and Villainy'
            ship: 'M3-A Interceptor'
            skill: 7
            slots: [
                'Elite'
            ]
            points: 19
        }
        {
            name: 'Quinn Jast'
            id: 246
            unique: true
            faction: 'Scum and Villainy'
            ship: 'M3-A Interceptor'
            skill: 6
            slots: [
                'Elite'
            ]
            points: 18
        }
        {
            name: 'Inaldra'
            id: 247
            unique: true
            faction: 'Scum and Villainy'
            ship: 'M3-A Interceptor'
            skill: 3
            slots: [
                'Elite'
            ]
            points: 15
        }
        {
            name: 'Sunny Bounder'
            id: 248
            unique: true
            faction: 'Scum and Villainy'
            ship: 'M3-A Interceptor'
            skill: 1
            slots: [ ]
            points: 14
        }
        {
            name: 'Kashyyyk Defender'
            id: 249
            faction: 'Rebel Alliance'
            ship: 'Auzituck Gunship'
            skill: 1
            slots: [
                'Crew'
                'Crew'
            ]
            points: 24
        }
        {
            name: 'Wookiee Liberator'
            id: 250
            faction: 'Rebel Alliance'
            ship: 'Auzituck Gunship'
            skill: 3
            slots: [
                'Elite'
                'Crew'
                'Crew'
            ]
            points: 26
        }
        {
            name: 'Lowhhrick'
            id: 251
            unique: true
            faction: 'Rebel Alliance'
            ship: 'Auzituck Gunship'
            skill: 5
            slots: [
                'Elite'
                'Crew'
                'Crew'
            ]
            points: 28
        }
        {
            name: 'Wullffwarro'
            id: 252
            faction: 'Rebel Alliance'
            unique: true
            ship: 'Auzituck Gunship'
            skill: 7
            slots: [
                'Elite'
                'Crew'
                'Crew'
            ]
            points: 30
        }
        {
            name: 'Captain Nym'
            id: 253
            unique: true
            faction: 'Scum and Villainy'
            ship: 'Scurrg H-6 Bomber'
            skill: 8
            slots: [
                'Elite'
                'Turret'
                'Torpedo'
                'Missile'
                'Crew'
                'Bomb'
                'Bomb'
            ]
            points: 30
        }
        {
            name: 'Captain Nym (Rebel)'
            aka: [ 'Captain Nym' ]
            id: 254
            canonical_name: 'Captain Nym'.canonicalize()
            unique: true
            faction: 'Rebel Alliance'
            ship: 'Scurrg H-6 Bomber'
            skill: 8
            slots: [
                'Elite'
                'Turret'
                'Torpedo'
                'Missile'
                'Crew'
                'Bomb'
                'Bomb'
            ]
            points: 30
        }
        {
            name: 'Sol Sixxa'
            id: 255
            faction: 'Scum and Villainy'
            unique: true
            ship: 'Scurrg H-6 Bomber'
            skill: 6
            slots: [
                'Elite'
                'Turret'
                'Torpedo'
                'Missile'
                'Crew'
                'Bomb'
                'Bomb'
            ]
            points: 28
        }
        {
            name: 'Lok Revenant'
            id: 256
            faction: 'Scum and Villainy'
            ship: 'Scurrg H-6 Bomber'
            skill: 3
            slots: [
                'Elite'
                'Turret'
                'Torpedo'
                'Missile'
                'Crew'
                'Bomb'
                'Bomb'
            ]
            points: 26
        }
        {
            name: 'Karthakk Pirate'
            id: 257
            faction: 'Scum and Villainy'
            ship: 'Scurrg H-6 Bomber'
            skill: 1
            slots: [
                'Turret'
                'Torpedo'
                'Missile'
                'Crew'
                'Bomb'
                'Bomb'
            ]
            points: 24
        }
        {
            name: 'Sienar Specialist'
            id: 258
            faction: 'Galactic Empire'
            ship: 'TIE Aggressor'
            skill: 2
            slots: [
                'Turret'
                'Missile'
                'Missile'
            ]
            points: 17
        }
        {
            name: 'Onyx Squadron Escort'
            id: 259
            faction: 'Galactic Empire'
            ship: 'TIE Aggressor'
            skill: 5
            slots: [
                'Turret'
                'Missile'
                'Missile'
            ]
            points: 19
        }
        {
            name: '"Double Edge"'
            id: 260
            unique: true
            faction: 'Galactic Empire'
            ship: 'TIE Aggressor'
            skill: 4
            slots: [
                'Elite'
                'Turret'
                'Missile'
                'Missile'
            ]
            points: 19
        }
        {
            name: 'Lieutenant Kestal'
            id: 261
            unique: true
            faction: 'Galactic Empire'
            ship: 'TIE Aggressor'
            skill: 7
            slots: [
                'Elite'
                'Turret'
                'Missile'
                'Missile'
            ]
            points: 22
        }
        {
            name: 'Viktor Hel'
            id: 262
            faction: 'Scum and Villainy'
            unique: true
            ship: 'Kihraxz Fighter'
            skill: 7
            slots: [
                'Elite'
                'Missile'
                'Illicit'
            ]
            points: 25
        }
        {
            name: 'Captain Jostero'
            id: 263
            skill: 4
            faction: 'Scum and Villainy'
            unique: true
            ship: 'Kihraxz Fighter'
            slots: [
                'Elite'
                'Missile'
                'Illicit'
            ]
            points: 24
        }
        {
            name: 'Dalan Oberos'
            id: 264
            faction: 'Scum and Villainy'
            unique: true
            ship: 'StarViper'
            skill: 6
            slots: [
                'Elite'
                'Torpedo'
            ]
            points: 30
        }
        {
            name: 'Thweek'
            id: 265
            faction: 'Scum and Villainy'
            unique: true
            ship: 'StarViper'
            skill: 4
            slots: [
                'Torpedo'
            ]
            points: 28
            applies_condition: ['Shadowed'.canonicalize(), 'Mimicked'.canonicalize()]
        }
        {
            name: 'Black Sun Assassin'
            id: 266
            faction: 'Scum and Villainy'
            ship: 'StarViper'
            skill: 5
            slots: [
                'Elite'
                'Torpedo'
            ]
            points: 28
        }
        {
            name: 'Major Vynder'
            id: 267
            unique: true
            faction: 'Galactic Empire'
            ship: 'Alpha-class Star Wing'
            skill: 7
            slots: [
                'Elite'
                'Torpedo'
                'Missile'
            ]
            points: 26
        }
        {
            name: 'Lieuten???'
            id: 268
            unique: true
            faction: 'Galactic Empire'
            ship: 'Alpha-class Star Wing'
            skill: 5
            slots: [
                'Torpedo'
                'Missile'
            ]
            points: 100
        }
        {
            name: 'Rho Squad???'
            id: 269
            faction: 'Galactic Empire'
            ship: 'Alpha-class Star Wing'
            skill: 4
            slots: [
                'Torpedo'
                'Missile'
            ]
            points: 100
        }
        {
            name: 'Nu Squa???'
            id: 270
            faction: 'Galactic Empire'
            ship: 'Alpha-class Star Wing'
            skill: 2
            slots: [
                'Torpedo'
                'Missile'
            ]
            points: 100
        }
        {
            name: 'Torani Kulda'
            id: 271
            unique: true
            faction: 'Scum and Villainy'
            ship: 'M12-L Kimogila Fighter'
            skill: 8
            slots: [
                'Elite'
                'Torpedo'
                'Missile'
                'Salvaged Astromech'
                'Illicit'
            ]
            points: 27
        }
        {
            name: 'Dal???'
            id: 272
            unique: true
            faction: 'Scum and Villainy'
            ship: 'M12-L Kimogila Fighter'
            skill: 7
            slots: [
                'Elite'
                'Torpedo'
                'Missile'
                'Salvaged Astromech'
                'Illicit'
            ]
            points: 100
        }
        {
            name: 'Cartel E???'
            id: 273
            faction: 'Scum and Villainy'
            ship: 'M12-L Kimogila Fighter'
            skill: 5
            slots: [
                'Elite'
                'Torpedo'
                'Missile'
                'Salvaged Astromech'
                'Illicit'
            ]
            points: 100
        }
        {
            name: 'Carte???'
            id: 274
            faction: 'Scum and Villainy'
            ship: 'M12-L Kimogila Fighter'
            skill: 3
            slots: [
                'Torpedo'
                'Missile'
                'Salvaged Astromech'
                'Illicit'
            ]
            points: 100
        }
        {
            name: 'Fenn Rau (Sheathipede)'
            id: 275
            canonical_name: 'Fenn Rau'.canonicalize()
            unique: true
            faction: 'Rebel Alliance'
            ship: 'Sheathipede-class Shuttle'
            skill: 9
            slots: [
                'Elite'
                'Crew'
                'Astromech'
            ]
            points: 20
        }
        {
            name: '"Zeb" Orrelios (Sheathipede)'
            id: 276
            canonical_name: '"Zeb" Orrelios'.canonicalize()
            unique: true
            faction: 'Rebel Alliance'
            ship: 'Sheathipede-class Shuttle'
            skill: 3
            slots: [
                'Crew'
                'Astromech'
            ]
            points: 100
        }
        {
            name: 'Ezra Bridger (Sheathipede)'
            id: 277
            canonical_name: 'Ezra Bridger'.canonicalize()
            unique: true
            faction: 'Rebel Alliance'
            ship: 'Sheathipede-class Shuttle'
            skill: 5
            slots: [
                'Crew'
                'Astromech'
            ]
            points: 100
        }
        {
            name: 'A???'
            id: 278
            faction: 'Rebel Alliance'
            unique: true
            ship: 'Sheathipede-class Shuttle'
            skill: 1
            slots: [
                'Crew'
                'Astromech'
            ]
            points: 100
        }
        {
            name: 'Crimson Sq???'
            id: 279
            faction: 'Resistance'
            ship: 'B/SF-17 Bomber'
            skill: 1
            slots: [
                'System'
                'Bomb'
                'Bomb'
                'Tech'
            ]
            points: 100
        }
        {
            name: '"Crimson ???'
            id: 280
            faction: 'Resistance'
            unique: true
            ship: 'B/SF-17 Bomber'
            skill: 4
            slots: [
                'System'
                'Bomb'
                'Bomb'
                'Tech'
            ]
            points: 100
        }
        {
            name: '"Cobal???'
            id: 281
            faction: 'Resistance'
            unique: true
            ship: 'B/SF-17 Bomber'
            skill: 6
            slots: [
                'System'
                'Bomb'
                'Bomb'
                'Tech'
            ]
            points: 100
        }
        {
            name: '"Crimson Leader"'
            id: 282
            faction: 'Resistance'
            unique: true
            ship: 'B/SF-17 Bomber'
            skill: 7
            slots: [
                'System'
                'Bomb'
                'Bomb'
                'Tech'
            ]
            points: 29
            applies_condition: 'Rattled'.canonicalize()
        }
        {
            name: 'Sienar-Jae???'
            id: 283
            faction: 'First Order'
            ship: 'TIE Silencer'
            skill: 4
            slots: [
                'System'
                'Tech'
            ]
            points: 100
        }
        {
            name: 'First Orde???'
            id: 284
            faction: 'First Order'
            ship: 'TIE Silencer'
            skill: 6
            slots: [
                'System'
                'Tech'
            ]
            points: 100
        }
        {
            name: 'Test Pilo???'
            id: 285
            faction: 'First Order'
            unique: true
            ship: 'TIE Silencer'
            skill: 6
            slots: [
                'System'
                'Tech'
            ]
            points: 100
        }
        {
            name: 'Kylo Ren (TIE Silencer)'
            id: 286
            canonical_name: 'Kylo Ren'.canonicalize()
            faction: 'First Order'
            unique: true
            ship: 'TIE Silencer'
            skill: 9
            slots: [
                'Elite'
                'System'
                'Tech'
            ]
            points: 35
            applies_condition: '''I'll Show You the Dark Side'''.canonicalize()
        }
    ]

    upgradesById: [
        {
            name: "Ion Cannon Turret"
            id: 0
            slot: "Turret"
            points: 5
            attack: 3
            range: "1-2"
        }
        {
            name: "Proton Torpedoes"
            id: 1
            slot: "Torpedo"
            points: 4
            attack: 4
            range: "2-3"
        }
        {
            name: "R2 Astromech"
            id: 2
            slot: "Astromech"
            points: 1
            modifier_func: (stats) ->
                if stats.maneuvers? and stats.maneuvers.length > 0
                    for turn in [0 ... stats.maneuvers[1].length]
                        if stats.maneuvers[1][turn] > 0
                            stats.maneuvers[1][turn] = 2
                        if stats.maneuvers[2][turn] > 0
                            stats.maneuvers[2][turn] = 2
        }
        {
            name: "R2-D2"
            aka: [ "R2-D2 (Crew)" ]
            canonical_name: 'r2d2'
            id: 3
            unique: true
            slot: "Astromech"
            points: 4
        }
        {
            name: "R2-F2"
            id: 4
            unique: true
            slot: "Astromech"
            points: 3
        }
        {
            name: "R5-D8"
            id: 5
            unique: true
            slot: "Astromech"
            points: 3
        }
        {
            name: "R5-K6"
            id: 6
            unique: true
            slot: "Astromech"
            points: 2
        }
        {
            name: "R5 Astromech"
            id: 7
            slot: "Astromech"
            points: 1
        }
        {
            name: "Determination"
            id: 8
            slot: "Disabled"
            points: 1
        }
        {
            name: "Swarm Tactics"
            id: 9
            slot: "Disabled"
            points: 2
        }
        {
            name: "Squad Leader"
            id: 10
            unique: true
            slot: "ActEPT"
            points: 2
        }
        {
            name: "Expert Handling"
            id: 11
            slot: "ActEPT"
            points: 2
        }
        {
            name: "Marksmanship"
            id: 12
            slot: "ActEPT"
            points: 3
        }
        {
            name: "Concussion Missiles"
            id: 13
            slot: "Missile"
            points: 4
            attack: 4
            range: "2-3"
        }
        {
            name: "Cluster Missiles"
            id: 14
            slot: "Missile"
            points: 4
            attack: 3
            range: "1-2"
        }
        {
            name: "Daredevil"
            id: 15
            slot: "ActEPT"
            points: 3
        }
        {
            name: "Elusiveness"
            id: 16
            slot: "Disabled"
            points: 2
        }
        {
            name: "Homing Missiles"
            id: 17
            slot: "Missile"
            attack: 4
            range: "2-3"
            points: 5
        }
        {
            name: "Push the Limit"
            id: 18
            slot: "Disabled"
            points: 3
        }
        {
            name: "Deadeye"
            id: 19
            slot: "Disabled"
            points: 1
            restriction_func: (ship) ->
                not ((ship.data.large ? false) or (ship.data.huge ? false))
        }
        {
            name: "Expose"
            id: 20
            slot: "ActEPT"
            points: 4
        }
        {
            name: "Gunner"
            id: 21
            slot: "Crew"
            points: 5
        }
        {
            name: "Ion Cannon"
            id: 22
            slot: "Cannon"
            points: 3
            attack: 3
            range: "1-3"
        }
        {
            name: "Heavy Laser Cannon"
            id: 23
            slot: "Cannon"
            points: 7
            attack: 4
            range: "2-3"
        }
        {
            name: "Seismic Charges"
            id: 24
            slot: "Bomb"
            points: 2
        }
        {
            name: "Mercenary Copilot"
            id: 25
            slot: "Crew"
            points: 2
        }
        {
            name: "Assault Missiles"
            id: 26
            slot: "Missile"
            points: 5
            attack: 4
            range: "2-3"
        }
        {
            name: "Veteran Instincts"
            id: 27
            slot: "Disabled"
            points: 1
            modifier_func: (stats) ->
                stats.skill += 2
        }
        {
            name: "Proximity Mines"
            id: 28
            slot: "Bomb"
            points: 3
        }
        {
            name: "Weapons Engineer"
            id: 29
            slot: "Crew"
            points: 3
        }
        {
            name: "Draw Their Fire"
            id: 30
            slot: "Disabled"
            points: 1
        }
        {
            name: "Luke Skywalker"
            aka: [ "Luke Skywalker." ]
            canonical_name: 'lukeskywalker'
            id: 31
            unique: true
            faction: "Rebel Alliance"
            slot: "Crew"
            points: 7
        }
        {
            name: "Nien Nunb"
            id: 32
            unique: true
            faction: "Rebel Alliance"
            slot: "Crew"
            points: 1
            modifier_func: (stats) ->
                for s, spd in (stats.maneuvers ? [])
                    continue if spd == 0
                    if s[2] > 0 # is there a straight (2) maneuver at this speed?
                        s[2] = 2 # set it to green (2)
        }
        {
            name: "Chewbacca"
            id: 33
            unique: true
            faction: "Rebel Alliance"
            slot: "Crew"
            points: 4
        }
        {
            name: "Advanced Proton Torpedoes"
            canonical_name: 'Adv. Proton Torpedoes'.canonicalize()
            id: 34
            slot: "Torpedo"
            attack: 5
            range: "1"
            points: 6
        }
        {
            name: "Autoblaster"
            id: 35
            slot: "Cannon"
            attack: 3
            range: "1"
            points: 5
        }
        {
            name: "Fire-Control System"
            id: 36
            slot: "System"
            points: 2
        }
        {
            name: "Blaster Turret"
            id: 37
            slot: "Turret"
            points: 4
            attack: 3
            range: "1-2"
        }
        {
            name: "Recon Specialist"
            id: 38
            slot: "Crew"
            points: 3
        }
        {
            name: "Saboteur"
            id: 39
            slot: "Crew"
            points: 2
        }
        {
            name: "Intelligence Agent"
            id: 40
            slot: "Crew"
            points: 1
        }
        {
            name: "Proton Bombs"
            id: 41
            slot: "Bomb"
            points: 5
        }
        {
            name: "Adrenaline Rush"
            id: 42
            slot: "DiscEPT"
            points: 1
        }
        {
            name: "Advanced Sensors"
            id: 43
            slot: "System"
            points: 3
        }
        {
            name: "Sensor Jammer"
            id: 44
            slot: "System"
            points: 4
        }
        {
            name: "Darth Vader"
            id: 45
            unique: true
            faction: "Galactic Empire"
            slot: "Crew"
            points: 3
        }
        {
            name: "Rebel Captive"
            id: 46
            unique: true
            faction: "Galactic Empire"
            slot: "Crew"
            points: 3
        }
        {
            name: "Flight Instructor"
            id: 47
            slot: "Crew"
            points: 4
        }
        {
            name: "Navigator"
            id: 48
            slot: "Crew"
            points: 3
            epic_restriction_func: (ship) ->
                not (ship.huge ? false)
        }
        {
            name: "Opportunist"
            id: 49
            slot: "Disabled"
            points: 4
        }
        {
            name: "Comms Booster"
            id: 50
            slot: "Cargo"
            points: 4
        }
        {
            name: "Slicer Tools"
            id: 51
            slot: "Cargo"
            points: 7
        }
        {
            name: "Shield Projector"
            id: 52
            slot: "Cargo"
            points: 4
        }
        {
            name: "Ion Pulse Missiles"
            id: 53
            slot: "Missile"
            points: 3
            attack: 3
            range: """2-3"""
        }
        {
            name: "Wingman"
            id: 54
            slot: "Disabled"
            points: 2
        }
        {
            name: "Decoy"
            id: 55
            slot: "Disabled"
            points: 2
        }
        {
            name: "Outmaneuver"
            id: 56
            slot: "Disabled"
            points: 3
        }
        {
            name: "Predator"
            id: 57
            slot: "Disabled"
            points: 3
        }
        {
            name: "Flechette Torpedoes"
            id: 58
            slot: "Torpedo"
            points: 2
            attack: 3
            range: """2-3"""
        }
        {
            name: "R7 Astromech"
            id: 59
            slot: "Astromech"
            points: 2
        }
        {
            name: "R7-T1"
            id: 60
            unique: true
            slot: "Astromech"
            points: 3
        }
        {
            name: "Tactician"
            id: 61
            slot: "Crew"
            points: 2
            limited: true
        }
        {
            name: "R2-D2 (Crew)"
            aka: [ "R2-D2" ]
            canonical_name: 'r2d2-swx22'
            id: 62
            unique: true
            slot: "Crew"
            points: 4
            faction: "Rebel Alliance"
        }
        {
            name: "C-3PO"
            unique: true
            id: 63
            slot: "Crew"
            points: 3
            faction: "Rebel Alliance"
        }
        {
            name: "Single Turbolasers"
            id: 64
            slot: "Hardpoint"
            points: 8
            energy: 2
            attack: 4
            range: "3-5"
        }
        {
            name: "Quad Laser Cannons"
            id: 65
            slot: "Hardpoint"
            points: 6
            energy: 2
            attack: 3
            range: "1-2"
        }
        {
            name: "Tibanna Gas Supplies"
            id: 66
            slot: "Cargo"
            points: 4
            limited: true
        }
        {
            name: "Ionization Reactor"
            id: 67
            slot: "Cargo"
            points: 4
            energy: 5
            limited: true
        }
        {
            name: "Engine Booster"
            id: 68
            slot: "Cargo"
            points: 3
            limited: true
        }
        {
            name: "R3-A2"
            id: 69
            unique: true
            slot: "Astromech"
            points: 2
        }
        {
            name: "R2-D6"
            id: 70
            unique: true
            slot: "Astromech"
            points: 1
            restriction_func: (ship) ->
                return false if (ship.effectiveStats().skill <= 2 or 'Elite' in ship.pilot.slots)
                # Otherwise, if there's an Elite slot upgrade, it has to have
                # been conferred, and it can't be conferred by another upgrade
                for upgrade in ship.upgrades
                    if upgrade? and upgrade.data?.name != 'R2-D6'
                        for conferred_addon in upgrade.conferredAddons
                            return false if conferred_addon.slot == 'Elite'
                true
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Elite"
                }
            ]
        }
        {
            name: "Enhanced Scopes"
            id: 71
            slot: "System"
            points: 1
        }
        {
            name: "Chardaan Refit"
            id: 72
            slot: "Missile"
            points: -2
            ship: "A-Wing"
        }
        {
            name: "Proton Rockets"
            id: 73
            slot: "Missile"
            points: 3
            attack: 2
            range: "1"
        }
        {
            name: "Kyle Katarn"
            id: 74
            unique: true
            slot: "Crew"
            points: 3
            faction: "Rebel Alliance"
        }
        {
            name: "Jan Ors"
            id: 75
            unique: true
            slot: "Crew"
            points: 2
            faction: "Rebel Alliance"
        }
        {
            name: "Toryn Farr"
            id: 76
            unique: true
            slot: "Crew"
            points: 6
            faction: "Rebel Alliance"
            restriction_func: exportObj.hugeOnly
        }
        {
            name: "R4-D6"
            id: 77
            unique: true
            slot: "Astromech"
            points: 1
        }
        {
            name: "R5-P9"
            id: 78
            unique: true
            slot: "Astromech"
            points: 3
        }
        {
            name: "WED-15 Repair Droid"
            id: 79
            slot: "Crew"
            points: 2
            restriction_func: exportObj.hugeOnly
        }
        {
            name: "Carlist Rieekan"
            id: 80
            unique: true
            slot: "Crew"
            points: 3
            faction: "Rebel Alliance"
            restriction_func: exportObj.hugeOnly
        }
        {
            name: "Jan Dodonna"
            id: 81
            unique: true
            slot: "Crew"
            points: 6
            faction: "Rebel Alliance"
            restriction_func: exportObj.hugeOnly
        }
        {
            name: "Expanded Cargo Hold"
            id: 82
            slot: "Cargo"
            points: 1
            ship: "GR-75 Medium Transport"
        }
        {
            name: "Backup Shield Generator"
            id: 83
            slot: "Cargo"
            limited: true
            points: 3
        }
        {
            name: "EM Emitter"
            id: 84
            slot: "Cargo"
            limited: true
            points: 3
        }
        {
            name: "Frequency Jammer"
            id: 85
            slot: "Cargo"
            limited: true
            points: 4
        }
        {
            name: "Han Solo"
            id: 86
            slot: "Crew"
            unique: true
            faction: "Rebel Alliance"
            points: 2
        }
        {
            name: "Leia Organa"
            id: 87
            slot: "Crew"
            unique: true
            faction: "Rebel Alliance"
            points: 4
        }
        {
            name: "Targeting Coordinator"
            id: 88
            slot: "Crew"
            limited: true
            points: 4
        }
        {
            name: "Raymus Antilles"
            id: 89
            slot: "Crew"
            unique: true
            faction: "Rebel Alliance"
            points: 6
            restriction_func: exportObj.hugeOnly
        }
        {
            name: "Gunnery Team"
            id: 90
            slot: "Team"
            limited: true
            points: 4
        }
        {
            name: "Sensor Team"
            id: 91
            slot: "Team"
            points: 4
        }
        {
            name: "Engineering Team"
            id: 92
            slot: "Team"
            limited: true
            points: 4
        }
        {
            name: "Lando Calrissian"
            id: 93
            slot: "Crew"
            unique: true
            faction: "Rebel Alliance"
            points: 3
        }
        {
            name: "Mara Jade"
            id: 94
            slot: "Crew"
            unique: true
            faction: "Galactic Empire"
            points: 3
        }
        {
            name: "Fleet Officer"
            id: 95
            slot: "Crew"
            faction: "Galactic Empire"
            points: 3
        }
        {
            name: "Stay On Target"
            id: 96
            slot: "Disabled"
            points: 2
        }
        {
            name: "Dash Rendar"
            id: 97
            unique: true
            slot: "Crew"
            points: 2
            faction: "Rebel Alliance"
        }
        {
            name: "Lone Wolf"
            id: 98
            unique: true
            slot: "Disabled"
            points: 2
        }
        {
            name: '"Leebo"'
            id: 99
            unique: true
            slot: "Crew"
            points: 2
            faction: "Rebel Alliance"
        }
        {
            name: "Ruthlessness"
            id: 100
            slot: "Disabled"
            points: 3
            faction: "Galactic Empire"
        }
        {
            name: "Intimidation"
            id: 101
            slot: "Disabled"
            points: 2
        }
        {
            name: "Ysanne Isard"
            id: 102
            unique: true
            slot: "Crew"
            points: 4
            faction: "Galactic Empire"
        }
        {
            name: "Moff Jerjerrod"
            id: 103
            unique: true
            slot: "Crew"
            points: 2
            faction: "Galactic Empire"
        }
        {
            name: "Ion Torpedoes"
            id: 104
            slot: "Torpedo"
            points: 5
            attack: 4
            range: "2-3"
        }
        {
            name: "Bodyguard"
            id: 105
            unique: true
            slot: "Disabled"
            points: 2
            faction: "Scum and Villainy"
        }
        {
            name: "Calculation"
            id: 106
            slot: "Disabled"
            points: 1
        }
        {
            name: "Accuracy Corrector"
            id: 107
            slot: "System"
            points: 3
        }
        {
            name: "Inertial Dampeners"
            id: 108
            slot: "Illicit"
            points: 1
        }
        {
            name: "Flechette Cannon"
            id: 109
            slot: "Cannon"
            points: 2
            attack: 3
            range: "1-3"
        }
        {
            name: '"Mangler" Cannon'
            id: 110
            slot: "Cannon"
            points: 4
            attack: 3
            range: "1-3"
        }
        {
            name: "Dead Man's Switch"
            id: 111
            slot: "Illicit"
            points: 2
        }
        {
            name: "Feedback Array"
            id: 112
            slot: "Illicit"
            points: 2
        }
        {
            name: '"Hot Shot" Blaster'
            id: 113
            slot: "Illicit"
            points: 3
            attack: 3
            range: "1-2"
        }
        {
            name: "Greedo"
            id: 114
            unique: true
            slot: "Crew"
            faction: "Scum and Villainy"
            points: 1
        }
        {
            name: "Salvaged Astromech"
            id: 115
            slot: "Salvaged Astromech"
            points: 2
        }
        {
            name: "Bomb Loadout"
            id: 116
            limited: true
            slot: "Torpedo"
            points: 0
            ship: "Y-Wing"
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Bomb"
                }
            ]
        }
        {
            name: '"Genius"'
            id: 117
            unique: true
            slot: "Salvaged Astromech"
            points: 0
        }
        {
            name: "Unhinged Astromech"
            id: 118
            slot: "Salvaged Astromech"
            points: 1
            modifier_func: (stats) ->
                if stats.maneuvers? and stats.maneuvers.length > 3
                    for turn in [0 ... stats.maneuvers[3].length]
                        if stats.maneuvers[3][turn] > 0
                            stats.maneuvers[3][turn] = 2
        }
        {
            name: "R4-B11"
            id: 119
            unique: true
            slot: "Salvaged Astromech"
            points: 3
        }
        {
            name: "Autoblaster Turret"
            id: 120
            slot: "Turret"
            points: 2
            attack: 2
            range: "1"
        }
        {
            name: "R4 Agromech"
            id: 121
            slot: "Salvaged Astromech"
            points: 2
        }
        {
            name: "K4 Security Droid"
            id: 122
            slot: "Crew"
            faction: "Scum and Villainy"
            points: 3
        }
        {
            name: "Outlaw Tech"
            id: 123
            limited: true
            slot: "Crew"
            faction: "Scum and Villainy"
            points: 2
        }
        {
            name: 'Advanced Targeting Computer'
            canonical_name: 'Adv. Targeting Computer'.canonicalize()
            id: 124
            slot: "System"
            points: 5
            ship: "TIE Advanced"
        }
        {
            name: 'Ion Cannon Battery'
            id: 125
            slot: "Hardpoint"
            points: 6
            energy: 2
            attack: 4
            range: "2-4"
        }
        {
            name: "Extra Munitions"
            id: 126
            slot: "Torpedo"
            limited: true
            points: 2
        }
        {
            name: "Cluster Mines"
            id: 127
            slot: "Bomb"
            points: 4
        }
        {
            name: 'Glitterstim'
            id: 128
            slot: "Illicit"
            points: 2
        }
        {
            name: 'Grand Moff Tarkin'
            unique: true
            id: 129
            slot: "Crew"
            points: 6
            faction: "Galactic Empire"
            restriction_func: (ship) ->
                ship.data.huge ? false
        }
        {
            name: 'Captain Needa'
            unique: true
            id: 130
            slot: "Crew"
            points: 2
            faction: "Galactic Empire"
            restriction_func: (ship) ->
                ship.data.huge ? false
        }
        {
            name: 'Admiral Ozzel'
            unique: true
            id: 131
            slot: "Crew"
            points: 2
            faction: "Galactic Empire"
            restriction_func: (ship) ->
                ship.data.huge ? false
        }
        {
            name: 'Emperor Palpatine'
            unique: true
            id: 132
            slot: "Crew"
            points: 8
            faction: "Galactic Empire"
            restriction_func: (ship, upgrade_obj) ->
                ship.hasAnotherUnoccupiedSlotLike upgrade_obj
            validation_func: (ship, upgrade_obj) ->
                upgrade_obj.occupiesAnotherUpgradeSlot()
            also_occupies_upgrades: [ "Crew" ]
        }
        {
            name: 'Bossk'
            unique: true
            id: 133
            faction: "Scum and Villainy"
            slot: "Crew"
            points: 2
        }
        {
            name: "Lightning Reflexes"
            id: 134
            slot: "DiscEPT"
            points: 1
            restriction_func: (ship) ->
                not ((ship.data.large ? false) or (ship.data.huge ? false))
        }
        {
            name: "Twin Laser Turret"
            id: 135
            slot: "Turret"
            points: 6
            attack: 3
            range: "2-3"
        }
        {
            name: "Plasma Torpedoes"
            id: 136
            slot: "Torpedo"
            points: 3
            attack: 4
            range: "2-3"
        }
        {
            name: "Ion Bombs"
            id: 137
            slot: "Bomb"
            points: 2
        }
        {
            name: "Conner Net"
            id: 138
            slot: "Bomb"
            points: 4
        }
        {
            name: "Bombardier"
            id: 139
            slot: "Crew"
            points: 1
        }
        {
            name: 'Crack Shot'
            id: 140
            slot: "DiscEPT"
            points: 1
        }
        {
            name: "Advanced Homing Missiles"
            canonical_name: 'Adv. Homing Missiles'.canonicalize()
            id: 141
            slot: "Missile"
            points: 3
            attack: 3
            range: "2"
        }
        {
            name: 'Agent Kallus'
            id: 142
            unique: true
            points: 2
            slot: 'Crew'
            faction: 'Galactic Empire'
        }
        {
            name: 'XX-23 S-Thread Tracers'
            id: 143
            points: 1
            slot: 'Missile'
            attack: 3
            range: '1-3'
        }
        {
            name: "Tractor Beam"
            id: 144
            slot: "Cannon"
            attack: 3
            range: "1-3"
            points: 1
        }
        {
            name: "Cloaking Device"
            id: 145
            unique: true
            slot: "Illicit"
            points: 2
            restriction_func: (ship) ->
                not ((ship.data.large ? false) or (ship.data.huge ? false))
        }
        {
            name: 'Shield Technician'
            id: 146
            slot: "Crew"
            points: 1
            restriction_func: (ship) ->
                ship.data.huge ? false
        }
        {
            name: 'Weapons Guidance'
            id: 147
            slot: "Tech"
            points: 2
        }
        {
            name: 'BB-8'
            id: 148
            unique: true
            slot: "Astromech"
            points: 2
        }
        {
            name: 'R5-X3'
            id: 149
            unique: true
            slot: "Astromech"
            points: 1
        }
        {
            name: 'Wired'
            id: 150
            slot: "Disabled"
            points: 1
        }
        {
            name: 'Cool Hand'
            id: 151
            slot: "DiscEPT"
            points: 1
        }
        {
            name: 'Juke'
            id: 152
            slot: "Disabled"
            points: 2
            restriction_func: (ship) ->
                not ((ship.data.large ? false) or (ship.data.huge ? false))
        }
        {
            name: 'Comm Relay'
            id: 153
            slot: 'Tech'
            points: 3
        }
        {
            name: 'Dual Laser Turret'
            id: 154
            points: 5
            slot: 'Hardpoint'
            attack: 3
            range: '1-3'
            energy: 1
            ship: 'Gozanti-class Cruiser'
        }
        {
            name: 'Broadcast Array'
            id: 155
            ship: 'Gozanti-class Cruiser'
            points: 2
            slot: 'Cargo'
            modifier_func: (stats) ->
                stats.actions.push 'Jam' if 'Jam' not in stats.actions
        }
        {
            name: 'Rear Admiral Chiraneau'
            id: 156
            unique: true
            points: 3
            slot: 'Crew'
            faction: 'Galactic Empire'
            restriction_func: (ship) ->
                ship.data.huge ? false
        }
        {
            name: 'Ordnance Experts'
            id: 157
            limited: true
            points: 5
            slot: 'Team'
        }
        {
            name: 'Docking Clamps'
            id: 158
            points: 0
            limited: true
            slot: 'Cargo'
            ship: 'Gozanti-class Cruiser'
        }
        {
            name: 'Kanan Jarrus'
            id: 159
            unique: true
            faction: 'Rebel Alliance'
            points: 3
            slot: 'Crew'
        }
        {
            name: '"Zeb" Orrelios'
            id: 160
            unique: true
            faction: 'Rebel Alliance'
            points: 1
            slot: 'Crew'
        }
        {
            name: 'Reinforced Deflectors'
            id: 161
            points: 3
            slot: 'System'
            restriction_func: (ship) ->
                ship.data.large ? false
        }
        {
            name: 'Dorsal Turret'
            id: 162
            points: 3
            slot: 'Turret'
            attack: 2
            range: '1-2'
        }
        {
            name: 'Targeting Astromech'
            id: 163
            slot: 'Astromech'
            points: 2
        }
        {
            name: 'Hera Syndulla'
            id: 164
            unique: true
            faction: 'Rebel Alliance'
            points: 1
            slot: 'Crew'
        }
        {
            name: 'Ezra Bridger'
            id: 165
            unique: true
            faction: 'Rebel Alliance'
            points: 3
            slot: 'Crew'
        }
        {
            name: 'Sabine Wren'
            id: 166
            unique: true
            faction: 'Rebel Alliance'
            points: 2
            slot: 'Crew'
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Bomb"
                }
            ]
        }
        {
            name: '"Chopper"'
            id: 167
            unique: true
            faction: 'Rebel Alliance'
            points: 0
            slot: 'Crew'
        }
        {
            name: 'Construction Droid'
            id: 168
            points: 3
            slot: 'Crew'
            limited: true
            restriction_func: (ship) ->
                ship.data.huge ? false
        }
        {
            name: 'Cluster Bombs'
            id: 169
            points: 4
            slot: 'Cargo'
        }
        {
            name: "Adaptability"
            id: 170
            slot: "Disabled"
            points: 0
        }
        {
            name: "Adaptability (old)"
            skip: true
            id: 171
            superseded_by_id: 170
            slot: "Disabled"
            points: 0
        }
        {
            name: "Electronic Baffle"
            id: 172
            slot: "System"
            points: 1
        }
        {
            name: "4-LOM"
            id: 173
            unique: true
            slot: "Crew"
            points: 1
            faction: "Scum and Villainy"
        }
        {
            name: "Zuckuss"
            id: 174
            unique: true
            slot: "Crew"
            points: 1
            faction: "Scum and Villainy"
        }
        {
            name: 'Rage'
            id: 175
            points: 1
            slot: "ActEPT"
        }
        {
            name: "Attanni Mindlink"
            id: 176
            faction: "Scum and Villainy"
            slot: "Disabled"
            points: 1
        }
        {
            name: "Boba Fett"
            id: 177
            unique: true
            slot: "Crew"
            points: 1
            faction: "Scum and Villainy"
        }
        {
            name: "Dengar"
            id: 178
            unique: true
            slot: "Crew"
            points: 3
            faction: "Scum and Villainy"
        }
        {
            name: '"Gonk"'
            id: 179
            unique: true
            slot: "Crew"
            faction: "Scum and Villainy"
            points: 2
        }
        {
            name: "R5-P8"
            id: 180
            unique: true
            slot: "Salvaged Astromech"
            points: 3
        }
        {
            name: 'Thermal Detonators'
            id: 181
            points: 3
            slot: 'Bomb'
        }
        {
            name: "Overclocked R4"
            id: 182
            slot: "Salvaged Astromech"
            points: 1
        }
        {
            name: 'Systems Officer'
            id: 183
            faction: 'Galactic Empire'
            limited: true
            points: 2
            slot: 'Crew'
        }
        {
            name: 'Tail Gunner'
            id: 184
            slot: 'Crew'
            limited: true
            points: 2
        }
        {
            name: 'R3 Astromech'
            id: 185
            slot: 'Astromech'
            points: 2
        }
        {
            name: 'Collision Detector'
            id: 186
            slot: 'System'
            points: 0
        }
        {
            name: 'Sensor Cluster'
            id: 187
            slot: 'Tech'
            points: 2
        }
        {
            name: 'Fearlessness'
            id: 188
            slot: "Disabled"
            faction: 'Scum and Villainy'
            points: 1
        }
        {
            name: 'Ketsu Onyo'
            id: 189
            slot: 'Crew'
            faction: 'Scum and Villainy'
            unique: true
            points: 1
        }
        {
            name: 'Latts Razzi'
            id: 190
            slot: 'Crew'
            faction: 'Scum and Villainy'
            unique: true
            points: 2
        }
        {
            name: 'IG-88D'
            id: 191
            slot: 'Crew'
            faction: 'Scum and Villainy'
            unique: true
            points: 1
        }
        {
            name: 'Rigged Cargo Chute'
            id: 192
            slot: 'Illicit'
            points: 1
            restriction_func: (ship) ->
                ship.data.large ? false
        }
        {
            name: 'Seismic Torpedo'
            id: 193
            slot: 'Torpedo'
            points: 2
        }
        {
            name: 'Black Market Slicer Tools'
            id: 194
            slot: 'Illicit'
            points: 1
        }
        {
            name: 'Kylo Ren'
            id: 195
            slot: 'Crew'
            unique: true
            faction: 'Galactic Empire'
            points: 3
            applies_condition: '''I'll Show You the Dark Side'''.canonicalize()
        }
        {
            name: 'Unkar Plutt'
            id: 196
            faction: 'Scum and Villainy'
            slot: 'Crew'
            unique: true
            points: 1
        }
        {
            name: 'A Score to Settle'
            id: 197
            applies_condition: 'A Debt to Pay'.canonicalize()
            slot: "Disabled"
            unique: true
            points: 0
        }
        {
            name: 'Jyn Erso'
            id: 198
            faction: 'Rebel Alliance'
            slot: 'Crew'
            unique: true
            points: 2
        }
        {
            name: 'Cassian Andor'
            id: 199
            faction: 'Rebel Alliance'
            slot: 'Crew'
            unique: true
            points: 2
        }
        {
            name: 'Finn'
            id: 200
            faction: 'Rebel Alliance'
            unique: true
            slot: 'Crew'
            points: 5
        }
        {
            name: 'Rey'
            id: 201
            faction: 'Rebel Alliance'
            unique: true
            slot: 'Crew'
            points: 2
        }
        {
            name: 'Burnout SLAM'
            id: 202
            slot: 'Illicit'
            points: 1
            restriction_func: (ship) ->
                ship.data.large ? false
            modifier_func: (stats) ->
                stats.actions.push 'SLAM' if 'SLAM' not in stats.actions
        }
        {
            name: 'Primed Thrusters'
            id: 203
            slot: 'Tech'
            points: 1
            restriction_func: (ship) ->
                not ((ship.data.large ? false) or (ship.data.huge ? false))
        }
        {
            name: 'Pattern Analyzer'
            id: 204
            slot: 'Tech'
            points: 2
        }
        {
            name: 'Snap Shot'
            id: 205
            slot: "Disabled"
            points: 2
            attack: 2
            range: 1
        }
        {
            name: 'M9-G8'
            id: 206
            slot: 'Astromech'
            unique: true
            points: 3
        }
        {
            name: 'EMP Device'
            id: 207
            slot: 'Illicit'
            unique: true
            points: 2
        }
        {
            name: 'Captain Rex'
            id: 208
            slot: 'Crew'
            faction: 'Rebel Alliance'
            unique: true
            points: 2
        }
        {
            name: 'General Hux'
            id: 209
            slot: 'Crew'
            unique: true
            faction: 'Galactic Empire'
            points: 5
            applies_condition: '''Fanatical Devotion'''.canonicalize()
        }
        {
            name: 'Operations Specialist'
            id: 210
            slot: 'Crew'
            limited: true
            points: 3
        }
        {
            name: 'Targeting Synchronizer'
            id: 211
            slot: 'Tech'
            points: 3
        }
        {
            name: 'Hyperwave Comm Scanner'
            id: 212
            slot: 'Tech'
            points: 1
        }
        {
            name: 'Hotshot Co-pilot'
            id: 213
            slot: 'Crew'
            points: 4
        }
        {
            name: 'Trick Shot'
            id: 214
            slot: "Disabled"
            points: 0
        }
        {
            name: '''Scavenger Crane'''
            id: 215
            slot: 'Illicit'
            points: 2
        }
        {
            name: 'Bodhi Rook'
            id: 216
            slot: 'Crew'
            unique: true
            faction: 'Rebel Alliance'
            points: 1
        }
        {
            name: 'Baze Malbus'
            id: 217
            slot: 'Crew'
            unique: true
            faction: 'Rebel Alliance'
            points: 3
        }
        {
            name: 'Inspiring Recruit'
            id: 218
            slot: 'Crew'
            points: 1
        }
        {
            name: 'Swarm Leader'
            id: 219
            unique: true
            slot: "Disabled"
            points: 3
        }
        {
            name: 'Expertise'
            id: 220
            slot: "Disabled"
            points: 4
        }
        {
            name: 'Bistan'
            id: 221
            slot: 'Crew'
            unique: true
            faction: 'Rebel Alliance'
            points: 2
        }
        {
            name: 'BoShek'
            id: 222
            slot: 'Crew'
            unique: true
            points: 2
        }
        {
            name: 'Heavy Laser Turret'
            id: 223
            ship: 'C-ROC Cruiser'
            slot: 'Hardpoint'
            points: 5
            energy: 2
            attack: 4
            range: '2-3'
        }
        {
            name: 'Cikatro Vizago'
            id: 224
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Crew'
            points: 0
        }
        {
            name: 'Azmorigan'
            id: 225
            faction: 'Scum and Villainy'
            slot: 'Crew'
            points: 2
            restriction_func: (ship) ->
                ship.data.huge ? false
        }
        {
            name: 'Quick-release Cargo Locks'
            id: 226
            slot: 'Cargo'
            points: 2
            restriction_func: (ship) ->
                ship.data.canonical_name in [ 'C-ROC Cruiser'.canonicalize(), 'GR-75 Medium Transport'.canonicalize() ]
        }
        {
            name: 'Supercharged Power Cells'
            id: 227
            limited: true
            slot: 'Cargo'
            points: 3
        }
        {
            name: 'ARC Caster'
            id: 228
            faction: [ 'Rebel Alliance', 'Scum and Villainy' ]
            slot: 'Cannon'
            points: 2
            attack: 4
            range: '1'
        }
        {
            name: 'Wookiee Commandos'
            id: 229
            slot: 'Crew'
            faction: 'Rebel Alliance'
            points: 1
            restriction_func: (ship, upgrade_obj) ->
                ship.hasAnotherUnoccupiedSlotLike upgrade_obj
            validation_func: (ship, upgrade_obj) ->
                upgrade_obj.occupiesAnotherUpgradeSlot()
            also_occupies_upgrades: [ "Crew" ]
        }
        {
            name: 'Synced Turret'
            id: 230
            slot: 'Turret'
            points: 4
            attack: 3
            range: '1-2'
        }
        {
            name: 'Unguided Rockets'
            id: 231
            slot: 'Missile'
            points: 2
            attack: 3
            range: '1-3'
            restriction_func: (ship, upgrade_obj) ->
                ship.hasAnotherUnoccupiedSlotLike upgrade_obj
            validation_func: (ship, upgrade_obj) ->
                upgrade_obj.occupiesAnotherUpgradeSlot()
            also_occupies_upgrades: [ 'Missile' ]
        }
        {
            name: 'Intensity'
            id: 232
            slot: "Disabled"
            points: 2
            restriction_func: (ship) ->
                not ((ship.data.large ? false) or (ship.data.huge ? false))
        }
        {
            name: 'Jabba the Hutt'
            id: 233
            unique: true
            slot: 'Crew'
            points: 5
            faction: 'Scum and Villainy'
            restriction_func: (ship, upgrade_obj) ->
                ship.hasAnotherUnoccupiedSlotLike upgrade_obj
            validation_func: (ship, upgrade_obj) ->
                upgrade_obj.occupiesAnotherUpgradeSlot()
            also_occupies_upgrades: [ "Crew" ]
        }
        {
            name: 'IG-RM Thug Droids'
            id: 234
            slot: 'Team'
            points: 1
        }
        {
            name: 'Selflessness'
            id: 235
            slot: "Disabled"
            unique: true
            faction: 'Rebel Alliance'
            points: 1
            restriction_func: (ship) ->
                not ((ship.data.large ? false) or (ship.data.huge ? false))
        }
        {
            name: 'Breach Specialist'
            id: 236
            slot: 'Crew'
            points: 1
        }
        {
            name: 'Bomblet Generator'
            id: 237
            slot: 'Bomb'
            unique: true
            points: 3
            restriction_func: (ship, upgrade_obj) ->
                ship.hasAnotherUnoccupiedSlotLike upgrade_obj
            validation_func: (ship, upgrade_obj) ->
                upgrade_obj.occupiesAnotherUpgradeSlot()
            also_occupies_upgrades: [ "Bomb" ]
        }
        {
            name: 'Cad Bane'
            id: 238
            slot: 'Crew'
            faction: 'Scum and Villainy'
            unique: true
            points: 2
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Bomb"
                }
            ]
        }
        {
            name: 'Minefield Mapper'
            id: 239
            slot: 'System'
            points: 0
        }
        {
            name: 'R4-E1'
            id: 240
            slot: 'Salvaged Astromech'
            unique: true
            points: 1
        }
        {
            name: 'Cruise Missiles'
            id: 241
            slot: 'Missile'
            points: 3
            attack: 1
            range: '2-3'
        }
        {
            name: 'Ion Dischargers'
            id: 242
            slot: 'Illicit'
            points: 2
        }
        {
            name: 'Harpoon Missiles'
            id: 243
            slot: 'Missile'
            points: 4
            attack: 4
            range: '2-3'
            applies_condition: 'Harpooned!'.canonicalize()
        }
        {
            name: 'Ordnance Silos'
            id: 244
            slot: 'Bomb'
            points: 2
            ship: 'B/SF-17 Bomber'
        }
        {
            name: 'Trajectory Simulator'
            id: 245
            slot: 'System'
            points: 1
        }







        #New EPTs#
        {
            name: '"Night Beast"'
            id: 246
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 3
        }
        {
            name: "Wedge Antilles"
            id: 247
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 5
        }
        {
            name: "Garven Dreis"
            id: 248
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Horton Salm'
            id: 249
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 4
        }
        {
            name: '"Dutch" Vander'
            id: 250
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 3
        }
        {
            name: '"Howlrunner"'
            id: 251
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 4
        }
        {
            name: '"Backstabber"'
            id: 252
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 3
        }
        {
            name: '"Winged Gundark"'
            id: 253
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Darth Vader.'
            aka: [ "Darth Vader" ]
            id: 254
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 5
        }
        {
            name: 'Maarek Stele'
            id: 255
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 4
        }
        {
            name: 'Tycho Celchu'
            id: 256
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 4
        }
        {
            name: 'Arvel Crynyd'
            id: 257
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Han Solo.'
            aka: [ "Han Solo" ]
            id: 258
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 5
        }
        {
            name: 'Lando Calrissian.'
            aka: [ "Lando Calrissian" ]
            id: 259
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 4
        }
        {
            name: 'Chewbacca.'
            aka: [ "Chewbacca" ]
            id: 260
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Soontir Fel'
            id: 261
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 5
        }
        {
            name: 'Turr Phennir'
            id: 262
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 4
        }
        {
            name: '''"Fel's Wrath"'''
            id: 263
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Boba Fett.'
            aka: [ "Boba Fett" ]
            id: 264
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 4
        }
        {
            name: 'Kath Scarlet'
            id: 265
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 4
        }
        {
            name: 'Krassis Trelix'
            id: 266
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Ten Numb'
            id: 267
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 4
        }
        {
            name: 'Ibtisam'
            id: 268
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Jan Ors.'
            aka: [ "Jan Ors" ]
            id: 269
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 4
        }
        {
            name: 'Kyle Katarn.'
            aka: [ "Kyle Katarn" ]
            id: 270
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Roark Garnet'
            id: 271
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 2
        }
        {
            name: 'Major Rhymer'
            id: 272
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 4
        }
        {
            name: 'Captain Jonus'
            id: 273
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Captain Kagi'
            id: 274
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 4
        }
        {
            name: 'Colonel Jendon'
            id: 275
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Captain Yorr'
            id: 276
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 2
        }
        {
            name: 'Airen Cracken'
            id: 277
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 4
        }
        {
            name: 'Lieutenant Blount'
            id: 278
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Corran Horn'
            id: 279
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 4
        }
        {
            name: "Etahn A'baht"
            id: 280
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Rexler Brath'
            id: 281
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 4
        }
        {
            name: 'Colonel Vessery'
            id: 282
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 3
        }
        {
            name: '"Whisper"'
            id: 283
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 4
        }
        {
            name: '"Echo"'
            id: 284
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Dash Rendar.'
            aka: [ "Dash Rendar" ]
            id: 285
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 4
        }
        {
            name: 'Eaden Vrill'
            id: 286
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 2
        }
        {
            name: '"Leebo".'
            aka: [ '"Leebo"' ]
            id: 287
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Captain Oicunn'
            id: 288
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 2
        }
        {
            name: 'Rear Admiral Chiraneau'
            id: 289
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 4
        }
        {
            name: 'Commander Kenkirk'
            id: 290
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Carnor Jax'
            id: 291
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 4
        }
        {
            name: 'Kir Kanos'
            id: 292
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Tetran Cowall'
            id: 293
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 4
        }
        {
            name: 'Lieutenant Lorrir'
            id: 294
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Wes Janson'
            id: 295
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Jek Porkins'
            id: 296
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 4
        }
        {
            name: '"Hobbie" Klivian'
            id: 297
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Tarn Mison'
            id: 298
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Jake Farrell'
            id: 299
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Gemmer Sojan'
            id: 300
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Keyan Farlander'
            id: 301
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Nera Dantels'
            id: 302
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Prince Xizor'
            id: 303
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Guri'
            id: 304
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Serissu'
            id: 305
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Laetin A\'shera'
            id: 306
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'IG-88A'
            id: 307
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'IG-88B'
            id: 308
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'IG-88C'
            id: 309
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'IG-88D.'
            aka: [ 'IG-88D' ]
            id: 310
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'N\'Dru Suhlak'
            id: 311
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Kaa\'to Leeachos'
            id: 312
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Boba Fett (Scum).'
            aka: [ 'Boba Fett (Scum)' ]
            id: 313
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
            'canonical_name': 'Boba Fett'.canonicalize()
        }
        {
            name: 'Kath Scarlet (Scum)'
            id: 314
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
            'canonical_name': 'Kath Scarlet'.canonicalize()
        }
        {
            name: 'Emon Azzameen'
            id: 315
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Kavil'
            id: 316
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Drea Renthal'
            id: 317
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Dace Bonearm'
            id: 318
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Palob Godalhi'
            id: 319
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Torkil Mux'
            id: 320
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Commander Alozen'
            id: 321
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Bossk.'
            id: 322
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Moralo Eval'
            id: 323
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Latts Razzi.'
            id: 324
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Talonbane Cobra'
            id: 325
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 5
        }
        {
            name: 'Graz the Hunter'
            id: 326
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Miranda Doni'
            id: 327
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Esege Tuketu'
            id: 328
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 3
        }
        {
            name: '"Redline"'
            id: 329
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 4
        }
        {
            name: '"Deathrain"'
            id: 330
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Juno Eclipse'
            id: 331
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Zertik Strom'
            id: 332
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Lieutenant Colzet'
            id: 333
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 2
        }
        {
            name: '"Scourge"'
            id: 334
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 4
        }
        {
            name: '"Youngster"'
            id: 335
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 3
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "ActEPT"
                }
            ]
        }
        {
            name: '"Wampa"'
            id: 336
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 2
        }
        {
            name: '"Chaser"'
            id: 337
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Hera Syndulla.'
            aka: [ 'Hera Syndulla' ]
            id: 338
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Kanan Jarrus.'
            aka: [ 'Kanan Jarrus' ]
            id: 339
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 3
        }
        {
            name: '"Chopper".'
            aka: [ '"Chopper"' ]
            id: 340
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Hera Syndulla (Attack Shuttle)'
            aka: [ 'Hera Syndulla' ]
            id: 341
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Disabled'
            points: 4
        }
        {
            name: 'Sabine Wren.'
            aka: [ 'Sabine Wren' ]
            id: 342
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Ezra Bridger.'
            aka: [ 'Ezra Bridger' ]
            id: 343
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 2
        }
        {
            name: '"Zeb" Orrelios.'
            aka: [ '"Zeb" Orrelios' ]
            id: 344
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'The Inquisitor'
            id: 345
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Valen Rudor'
            id: 346
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Zuckuss.'
            aka: [ 'Zuckuss' ]
            id: 347
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
        }
        {
            name: '4-LOM.'
            aka: [ '4-LOM' ]
            id: 348
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Dengar.'
            aka: [ 'Dengar' ]
            id: 349
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 5
        }
        {
            name: 'Tel Trevura'
            id: 350
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Manaroo'
            id: 351
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Poe Dameron'
            id: 352
            unique: true
            faction: 'Resistance'
            slot: 'Disabled'
            points: 4
        }
        {
            name: '"Blue Ace"'
            id: 353
            unique: true
            faction: 'Resistance'
            slot: 'Elite'
            points: 3
        }
        {
            name: '"Omega Ace"'
            id: 354
            unique: true
            faction: 'First Order'
            slot: 'Elite'
            points: 4
        }
        {
            name: '"Epsilon Leader"'
            id: 355
            unique: true
            faction: 'First Order'
            slot: 'Elite'
            points: 3
        }
        {
            name: '"Zeta Ace"'
            id: 356
            unique: true
            faction: 'First Order'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Ello Asty'
            id: 357
            unique: true
            faction: 'Resistance'
            slot: 'Elite'
            points: 4
        }
        {
            name: '"Red Ace"'
            id: 358
            unique: true
            faction: 'Resistance'
            slot: 'Elite'
            points: 3
        }
        {
            name: '"Omega Leader"'
            id: 359
            unique: true
            faction: 'First Order'
            slot: 'Elite'
            points: 4
        }
        {
            name: '"Zeta Leader"'
            id: 360
            unique: true
            faction: 'First Order'
            slot: 'Elite'
            points: 4
        }
        {
            name: '"Epsilon Ace"'
            id: 361
            unique: true
            faction: 'First Order'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Tomax Bren'
            id: 362
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 4
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "DiscEPT"
                }
            ]
        }
        {
            name: '"Deathfire"'
            id: 363
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Maarek Stele (TIE Defender)'
            id: 364
            unique: true
            faction: 'Galactic Empire'
            slot: 'Disabled'
            points: 4
            'canonical_name': 'maarekstele'
        }
        {
            name: 'Countess Ryad'
            id: 365
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Poe Dameron (PS9)'
            aka: [ 'Poe Dameron' ]
            id: 366
            unique: true
            faction: 'Resistance'
            slot: 'Elite'
            points: 5
            'canonical_name': 'poedameron-swx57'
        }
        {
            name: 'Nien Nunb.'
            aka: [ 'Nien Nunb' ]
            id: 367
            unique: true
            faction: 'Resistance'
            slot: 'Elite'
            points: 4
        }
        {
            name: '"Snap" Wexley'
            id: 368
            unique: true
            faction: 'Resistance'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Jess Pava'
            id: 369
            unique: true
            faction: 'Resistance'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Han Solo (TFA)'
            aka: [ 'Han Solo' ]
            id: 370
            unique: true
            faction: 'Resistance'
            slot: 'Elite'
            points: 5
            'canonical_name': 'hansolo-swx57'
        }
        {
            name: 'Rey.'
            aka: [ 'Rey' ]
            id: 371
            unique: true
            faction: 'Resistance'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Chewbacca (TFA)'
            aka: [ 'Chewbacca' ]
            id: 372
            unique: true
            faction: 'Resistance'
            slot: 'Elite'
            points: 3
            'canonical_name': 'chewbacca-swx57'
        }
        {
            name: 'Norra Wexley'
            id: 373
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Shara Bey'
            id: 374
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Thane Kyrell'
            id: 375
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Braylen Stramm'
            id: 376
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 2
        }
        {
            name: '"Quickdraw"'
            id: 377
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 5
        }
        {
            name: '"Backdraft"'
            id: 378
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Fenn Rau'
            id: 379
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 5
        }
        {
            name: 'Old Teroch'
            id: 380
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Kad Solus'
            id: 381
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Ketsu Onyo.'
            aka: [ 'Ketsu Onyo' ]
            id: 382
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Asajj Ventress'
            id: 383
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Sabine Wren (Scum)'
            id: 384
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
            'canonical_name': 'sabinewren'
        }
        {
            name: 'Ahsoka Tano'
            id: 385
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Sabine Wren (TIE Fighter)'
            aka: [ 'Sabine Wren' ]
            id: 386
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Disabled'
            points: 3
            'canonical_name': 'sabinewren'
        }
        {
            name: 'Captain Rex.'
            aka: [ 'Captain Rex' ]
            id: 387
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 2
            applies_condition: 'Suppressive Fire'.canonicalize()
        }
        {
            name: '"Zeb" Orrelios (TIE Fighter)'
            aka: [ '"Zeb" Orrelios' ]
            id: 388
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Disabled'
            points: 2
            'canonical_name': '"Zeb" Orrelios'.canonicalize()
        }
        {
            name: 'Kylo Ren.'
            aka: [ 'Kylo Ren' ]
            id: 389
            unique: true
            faction: 'First Order'
            slot: 'Elite'
            points: 3
            applies_condition: '''I'll Show You the Dark Side'''.canonicalize()
        }
        {
            name: 'Major Stridan'
            id: 390
            unique: true
            faction: 'First Order'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Lieutenant Dormitz'
            id: 391
            unique: true
            faction: 'First Order'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Constable Zuvio'
            id: 392
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Sarco Plank'
            id: 393
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Unkar Plutt.'
            aka: [ 'Unkar Plutt' ]
            id: 394
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Cassian Andor.'
            aka: [ 'Cassian Andor' ]
            id: 395
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Bodhi Rook.'
            aka: [ 'Bodhi Rook' ]
            id: 396
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Heff Tobber'
            id: 397
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 2
        }
        {
            name: '"Duchess"'
            id: 398
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 4
        }
        {
            name: '"Pure Sabacc"'
            id: 399
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 3
        }
        {
            name: '"Countdown"'
            id: 400
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Genesis Red'
            id: 401
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Quinn Jast'
            id: 402
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Inaldra'
            id: 403
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Sunny Bounder'
            id: 404
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 1
        }
        {
            name: 'Lowhhrick'
            id: 405
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Wullffwarro'
            id: 406
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Captain Nym'
            id: 407
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Captain Nym (Rebel)'
            aka: [ 'Captain Nym' ]
            id: 408
            unique: true
            faction: 'Rebel Alliance'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Sol Sixxa'
            id: 409
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: '"Double Edge"'
            id: 410
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Lieutenant Kestal'
            id: 411
            unique: true
            faction: 'Galactic Empire'
            slot: 'Elite'
            points: 4
        }
        {
            name: "Luke Skywalker."
            aka: [ "Luke Skywalker" ]
            id: 412
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 4
        }
        {
            name: "Biggs Darklighter"
            id: 413
            unique: true
            faction: "Rebel Alliance"
            slot: "Elite"
            points: 3
        }
        {
            name: '"Mauler Mithel"'
            id: 414
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 4
        }
        {
            name: '"Dark Curse"'
            id: 415
            unique: true
            faction: "Galactic Empire"
            slot: "Elite"
            points: 3
        }
        {
            name: 'Viktor Hel'
            id: 416
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 4
        }
        {
            name: 'Captain Jostero'
            id: 417
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 2
        }
        {
            name: 'Dalan Oberos'
            id: 418
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 3
        }
        {
            name: 'Thweek'
            id: 419
            unique: true
            faction: 'Scum and Villainy'
            slot: 'Elite'
            points: 2
            applies_condition: ['Shadowed'.canonicalize(), 'Mimicked'.canonicalize()]
        }
    ]

    modificationsById: [
        {
            name: "Zero modification"
            id: 0
            skip: true
        }
        {
            name: "Stealth Device"
            id: 1
            points: 3
            modifier_func: (stats) ->
                stats.agility += 1
        }
        {
            name: "Shield Upgrade"
            id: 2
            points: 4
            modifier_func: (stats) ->
                stats.shields += 1
        }
        {
            name: "Engine Upgrade"
            id: 3
            points: 4
            modifier_func: (stats) ->
                stats.actions.push 'Boost' if 'Boost' not in stats.actions
        }
        {
            name: "Anti-Pursuit Lasers"
            id: 4
            points: 2
            restriction_func: (ship) ->
                ship.data.large ? false
        }
        {
            name: "Targeting Computer"
            id: 5
            points: 2
            modifier_func: (stats) ->
                stats.actions.push 'Target Lock' if 'Target Lock' not in stats.actions
        }
        {
            name: "Hull Upgrade"
            id: 6
            points: 3
            modifier_func: (stats) ->
                stats.hull += 1
        }
        {
            name: "Munitions Failsafe"
            id: 7
            points: 1
        }
        {
            name: "Stygium Particle Accelerator"
            id: 8
            points: 2
        }
        {
            name: "Advanced Cloaking Device"
            id: 9
            points: 4
            ship: "TIE Phantom"
        }
        {
            name: "Combat Retrofit"
            id: 10
            points: 10
            ship: "GR-75 Medium Transport"
            huge: true
            modifier_func: (stats) ->
                stats.hull += 2
                stats.shields += 1
        }
        {
            name: "B-Wing/E2"
            id: 11
            points: 1
            ship: "B-Wing"
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Crew"
                }
            ]
        }
        {
            name: "Countermeasures"
            id: 12
            points: 3
            restriction_func: (ship) ->
                ship.data.large ? false
        }
        {
            name: "Experimental Interface"
            id: 13
            unique: true
            points: 3
        }
        {
            name: "Tactical Jammer"
            id: 14
            points: 1
            restriction_func: (ship) ->
                ship.data.large ? false
        }
        {
            name: "Autothrusters"
            id: 15
            points: 2
            restriction_func: (ship) ->
                "Boost" in ship.effectiveStats().actions
        }
        {
            name: "Advanced SLAM"
            id: 16
            points: 2
        }
        {
            name: "Twin Ion Engine Mk. II"
            id: 17
            points: 1
            restriction_func: (ship) ->
                ship.data.name.indexOf('TIE') != -1
            modifier_func: (stats) ->
                for s in (stats.maneuvers ? [])
                    s[1] = 2 if s[1] != 0
                    s[3] = 2 if s[3] != 0
        }
        {
            name: "Maneuvering Fins"
            id: 18
            points: 1
            ship: "YV-666"
        }
        {
            name: "Ion Projector"
            id: 19
            points: 2
            restriction_func: (ship) ->
                ship.data.large ? false
        }
        {
            name: 'Integrated Astromech'
            id: 20
            restriction_func: (ship) ->
                ship.data.canonical_name.indexOf('xwing') != -1
            points: 0
        }
        {
            name: 'Optimized Generators'
            id: 21
            points: 5
            restriction_func: (ship) ->
                ship.data.huge ? false
        }
        {
            name: 'Automated Protocols'
            id: 22
            points: 5
            restriction_func: (ship) ->
                ship.data.huge ? false
        }
        {
            name: 'Ordnance Tubes'
            id: 23
            points: 5
            slot: 'Hardpoint'
            restriction_func: (ship) ->
                ship.data.huge ? false
        }
        {
            name: 'Long-Range Scanners'
            id: 24
            points: 0
            restriction_func: (ship) ->
                ((upgrade for upgrade in ship.upgrades when upgrade.slot == 'Torpedo' and not upgrade.occupied_by?).length >= 1) and ((upgrade for upgrade in ship.upgrades when upgrade.slot == 'Missile' and not upgrade.occupied_by?).length >= 1)
        }
        {
            name: "Guidance Chips"
            id: 25
            points: 0
        }
        {
            name: 'Vectored Thrusters'
            id: 26
            points: 2
            restriction_func: (ship) ->
                not ((ship.data.large ? false) or (ship.data.huge ? false))
            modifier_func: (stats) ->
                stats.actions.push 'Barrel Roll' if 'Barrel Roll' not in stats.actions
        }
        {
            name: 'Smuggling Compartment'
            id: 27
            points: 0
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Illicit"
                }
                {
                    type: exportObj.RestrictedModification
                    filter_func: (mod) ->
                        mod.points <= 3
                }
            ]
            limited: true
            restriction_func: (ship) ->
                ship.data.name in ['YT-1300', 'YT-2400']
        }
        {
            id: 28
            name: 'Gyroscopic Targeting'
            ship: 'Lancer-class Pursuit Craft'
            points: 2
        }
        {
            name: 'Captured TIE'
            id: 29
            unique: true
            ship: 'TIE Fighter'
            faction: 'Rebel Alliance'
            points: 1
        }
        {
            name: 'Spacetug Tractor Array'
            id: 30
            ship: 'Quadjumper'
            points: 2
        }
        {
            name: 'Lightweight Frame'
            id: 31
            points: 2
            restriction_func: (ship) ->
                ship.data.name.indexOf('TIE') != -1 and ship.effectiveStats().agility < 3
        }
        {
            name: 'Pulsed Ray Shield'
            id: 32
            faction: ['Rebel Alliance', 'Scum and Villainy']
            points: 2
            restriction_func: (ship) ->
                ship.effectiveStats().shields == 1
        }
    ]

    titlesById: [
        {
            name: "Zero Title"
            id: 0
            skip: true
        }
        {
            name: "Slave I"
            id: 1
            unique: true
            points: 0
            ship: "Firespray-31"
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Torpedo"
                }
            ]
        }
        {
            name: "Millennium Falcon"
            id: 2
            unique: true
            points: 1
            ship: "YT-1300"
            actions: "Evade"
            modifier_func: (stats) ->
                stats.actions.push 'Evade' if 'Evade' not in stats.actions
        }
        {
            name: "Moldy Crow"
            id: 3
            unique: true
            points: 3
            ship: "HWK-290"
        }
        {
            name: "ST-321"
            id: 4
            unique: true
            points: 3
            ship: "Lambda-Class Shuttle"
        }
        {
            name: "Royal Guard TIE"
            id: 5
            points: 0
            ship: "TIE Interceptor"
            confersAddons: [
                {
                    type: exportObj.Modification
                }
            ]
            restriction_func: (ship) ->
                ship.effectiveStats().skill > 4
            special_case: 'Royal Guard TIE'
        }
        {
            name: "Dodonna's Pride"
            id: 6
            unique: true
            points: 4
            ship: "CR90 Corvette (Fore)"
        }
        {
            name: "A-Wing Test Pilot"
            id: 7
            points: 0
            ship: "A-Wing"
            restriction_func: (ship) ->
                ship.effectiveStats().skill > 1
            validation_func: (ship, upgrade_obj) ->
                # Still need to respect the restriction
                return false unless ship.effectiveStats().skill > 1
                # No two Elites are on fir^W^W^Wcan be the same
                elites = (upgrade.data.canonical_name for upgrade in ship.upgrades when upgrade.slot == 'Elite' and upgrade.data?)
                while elites.length > 0
                    elite = elites.pop()
                    if elite in elites
                        return false
                true
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Elite"
                }
            ]
            special_case: "A-Wing Test Pilot"
        }
        # Apparently this is a modification, NOT a title
        # Leaving this here to occupy the ID in case someone used it
         {
             name: "B-Wing/E"
             id: 8
             skip: true
             points: 99
             ship: "B-Wing"
             confersAddons: [
                 {
                     type: exportObj.Upgrade
                     slot: "Crew"
                 }
             ]
         }
        {
            name: "Tantive IV"
            id: 9
            unique: true
            points: 4
            ship: "CR90 Corvette (Fore)"
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Crew"
                }
                {
                    type: exportObj.Upgrade
                    slot: "Team"
                }
            ]
        }
        {
            name: "Bright Hope"
            id: 10
            energy: "+2"
            unique: true
            points: 5
            ship: "GR-75 Medium Transport"
            modifier_func: (stats) ->
                stats.energy += 2
        }
        {
            name: "Quantum Storm"
            id: 11
            energy: "+1"
            unique: true
            points: 4
            ship: "GR-75 Medium Transport"
            modifier_func: (stats) ->
                stats.energy += 1
        }
        {
            name: "Dutyfree"
            id: 12
            energy: "+0"
            unique: true
            points: 2
            ship: "GR-75 Medium Transport"
        }
        {
            name: "Jaina's Light"
            id: 13
            unique: true
            points: 2
            ship: "CR90 Corvette (Fore)"
        }
        {
            name: "Outrider"
            id: 14
            unique: true
            points: 5
            ship: "YT-2400"
        }
        {
            name: "Dauntless"
            id: 15
            unique: true
            points: 2
            ship: "VT-49 Decimator"
        }
        {
            name: "Virago"
            id: 16
            unique: true
            points: 1
            ship: "StarViper"
            restriction_func: (ship) ->
                ship.pilot.skill > 3
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "System"
                }
                {
                    type: exportObj.Upgrade
                    slot: "Illicit"
                }
            ]
        }
        {
            name: '"Heavy Scyk" Interceptor (Cannon)'
            canonical_name: '"Heavy Scyk" Interceptor'.canonicalize()
            id: 17
            points: 2
            ship: "M3-A Interceptor"
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Cannon"
                }
            ]
            modifier_func: (stats) ->
                stats.hull += 1
        }
        {
            name: '"Heavy Scyk" Interceptor (Torpedo)'
            canonical_name: '"Heavy Scyk" Interceptor'.canonicalize()
            id: 18
            points: 2
            ship: "M3-A Interceptor"
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Torpedo"
                }
            ]
            modifier_func: (stats) ->
                stats.hull += 1
        }
        {
            name: '"Heavy Scyk" Interceptor (Missile)'
            canonical_name: '"Heavy Scyk" Interceptor'.canonicalize()
            id: 19
            points: 2
            ship: "M3-A Interceptor"
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Missile"
                }
            ]
            modifier_func: (stats) ->
                stats.hull += 1
        }
        {
            name: 'IG-2000'
            faction: 'Scum and Villainy'
            id: 20
            points: 0
            ship: "Aggressor"
        }
        {
            name: "BTL-A4 Y-Wing"
            id: 21
            points: 0
            ship: "Y-Wing"
        }
        {
            name: "Andrasta"
            id: 22
            unique: true
            points: 0
            ship: "Firespray-31"
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Bomb"
                }
                {
                    type: exportObj.Upgrade
                    slot: "Bomb"
                }
            ]
        }
        {
            name: 'TIE/x1'
            id: 23
            points: 0
            ship: "TIE Advanced"
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "System"
                    adjustment_func: (upgrade) ->
                        copy = $.extend true, {}, upgrade
                        copy.points = Math.max(0, copy.points - 4)
                        copy
                }
            ]
        }
        {
            name: "Hound's Tooth"
            id: 24
            points: 6
            unique: true
            ship: "YV-666"
        }
        {
            name: "Ghost"
            id: 25
            unique: true
            points: 0
            ship: "VCX-100"
        }
        {
            name: "Phantom"
            id: 26
            unique: true
            points: 0
            ship: "Attack Shuttle"
        }
        {
            name: "TIE/v1"
            id: 27
            points: 1
            ship: "TIE Advanced Prototype"
        }
        {
            name: "Mist Hunter"
            id: 28
            unique: true
            points: 0
            ship: "G-1A Starfighter"
            confersAddons: [
                {
                    type: exportObj.RestrictedUpgrade
                    slot: "Cannon"
                    filter_func: (upgrade) ->
                        upgrade.english_name == 'Tractor Beam'
                    auto_equip: 144
                }
            ]
            modifier_func: (stats) ->
                stats.actions.push 'Barrel Roll' if 'Barrel Roll' not in stats.actions
        }
        {
            name: "Punishing One"
            id: 29
            unique: true
            points: 12
            ship: "JumpMaster 5000"
            modifier_func: (stats) ->
                stats.attack += 1
        }
        {
            name: 'Assailer'
            id: 30
            points: 2
            unique: true
            ship: "Raider-class Corvette (Aft)"
        }
        {
            name: 'Instigator'
            id: 31
            points: 4
            unique: true
            ship: "Raider-class Corvette (Aft)"
        }
        {
            name: 'Impetuous'
            id: 32
            points: 3
            unique: true
            ship: "Raider-class Corvette (Aft)"
        }
        {
            name: 'TIE/x7'
            id: 33
            ship: 'TIE Defender'
            points: -2
            unequips_upgrades: [
                'Cannon'
                'Missile'
            ]
            also_occupies_upgrades: [
                'Cannon'
                'Missile'
            ]
        }
        {
            name: 'TIE/D'
            id: 34
            ship: 'TIE Defender'
            points: 0
        }
        {
            name: 'TIE Shuttle'
            id: 35
            ship: 'TIE Bomber'
            points: 0
            unequips_upgrades: [
                'Torpedo'
                'Torpedo'
                'Missile'
                'Missile'
                'Bomb'
            ]
            also_occupies_upgrades: [
                'Torpedo'
                'Torpedo'
                'Missile'
                'Missile'
                'Bomb'
            ]
            confersAddons: [
                {
                    type: exportObj.RestrictedUpgrade
                    slot: 'Crew'
                    filter_func: (upgrade) ->
                        upgrade.points <= 4
                }
                {
                    type: exportObj.RestrictedUpgrade
                    slot: 'Crew'
                    filter_func: (upgrade) ->
                        upgrade.points <= 4
                }
            ]
        }
        {
            name: 'Requiem'
            id: 36
            unique: true
            ship: 'Gozanti-class Cruiser'
            energy: '+0'
            points: 4
        }
        {
            name: 'Vector'
            id: 37
            unique: true
            ship: 'Gozanti-class Cruiser'
            energy: '+1'
            points: 2
            modifier_func: (stats) ->
                stats.energy += 1
        }
        {
            name: 'Suppressor'
            id: 38
            unique: true
            ship: 'Gozanti-class Cruiser'
            energy: '+2'
            points: 6
            modifier_func: (stats) ->
                stats.energy += 2
        }
        {
            name: 'Black One'
            id: 39
            unique: true
            ship: 'T-70 X-Wing'
            points: 1
            restriction_func: (ship) ->
                ship.effectiveStats().skill > 6
        }
        {
            name: "Millennium Falcon (TFA)"
            canonical_name: "millenniumfalcon-swx57"
            id: 40
            unique: true
            points: 1
            ship: "YT-1300"
        }
        {
            name: 'Alliance Overhaul'
            id: 41
            ship: 'ARC-170'
            points: 0
        }
        {
            name: 'Special Ops Training'
            id: 42
            ship: 'TIE/sf Fighter'
            points: 0
        }
        {
            name: 'Concord Dawn Protector'
            id: 43
            ship: 'Protectorate Starfighter'
            points: 1
        }
        {
            name: 'Shadow Caster'
            id: 44
            unique: true
            ship: 'Lancer-class Pursuit Craft'
            points: 3
        }
        {
            name: '''Kylo Ren's Shuttle'''
            id: 45
            unique: true
            ship: 'Upsilon-class Shuttle'
            points: 2
        }
        {
            name: '''Sabine's Masterpiece'''
            id: 46
            ship: 'TIE Fighter'
            faction: 'Rebel Alliance'
            unique: true
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Crew"
                }
                {
                    type: exportObj.Upgrade
                    slot: "Illicit"
                }
            ]
            points: 1
        }
        {
            name: '''Pivot Wing'''
            id: 47
            ship: 'U-Wing'
            points: 0
        }
        {
            name: '''Adaptive Ailerons'''
            id: 48
            ship: 'TIE Striker'
            points: 0
        }
        {
            name: '''Merchant One'''
            id: 49
            ship: 'C-ROC Cruiser'
            points: 2
            energy: '+1'
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Crew"
                }
                {
                    type: exportObj.Upgrade
                    slot: "Team"
                }
            ]
            unequips_upgrades: [ "Cargo" ]
            also_occupies_upgrades: [ "Cargo" ]
            modifier_func: (stats) ->
                stats.energy += 2
        }
        {
            name: '''"Light Scyk" Interceptor'''
            id: 50
            ship: 'M3-A Interceptor'
            points: -2
            unequips_modifications: true
            also_occupies_modifications: true
            modifier_func: (stats) ->
                for s in (stats.maneuvers ? [])
                    s[1] = 2 if s[1] != 0
                    s[3] = 2 if s[3] != 0
        }
        {
            name: '''Insatiable Worrt'''
            id: 51
            ship: 'C-ROC Cruiser'
            points: 1
            energy: '-1'
            modifier_func: (stats) ->
                stats.energy -= 1
        }
        {
            name: '''Broken Horn'''
            id: 52
            ship: 'C-ROC Cruiser'
            points: 5
            energy: '+2'
            modifier_func: (stats) ->
                stats.energy += 2
        }
        {
            name: 'Havoc'
            id: 53
            ship: 'Scurrg H-6 Bomber'
            unique: true
            points: 0
            unequips_upgrades: [
                'Crew'
            ]
            also_occupies_upgrades: [
                'Crew'
            ]
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: 'System'
                }
                {
                    type: exportObj.RestrictedUpgrade
                    slot: 'Salvaged Astromech'
                    filter_func: (upgrade) ->
                        upgrade.unique
                }
            ]
        }
        {
            name: 'Vaksai'
            id: 54
            points: 0
            ship: 'Kihraxz Fighter'
            confersAddons: [
                {
                    type: exportObj.Modification
                }
                {
                    type: exportObj.Modification
                }
            ]
            special_case: 'Royal Guard TIE'
        }
        {
            name: 'StarViper Mk. II'
            id: 55
            limited: true
            points: -3
            ship: 'StarViper'
            confersAddons: [
                {
                    type: exportObj.Title
                }
            ]
        }
        {
            name: 'XG-1 Assault Configuration'
            id: 56
            points: 1
            ship: 'Alpha-class Star Wing'
            confersAddons: [
                {
                    type: exportObj.Upgrade
                    slot: "Cannon"
                }
                {
                    type: exportObj.Upgrade
                    slot: "Cannon"
                }
            ]
        }
        {
            name: 'Enforcer'
            id: 57
            unique: true
            ship: 'M12-L Kimogila Fighter'
            points: 1
        }
        {
            name: 'Ghost (Phantom II)'
            id: 58
            canonical_name: 'ghost-swx72'
            ship: 'VCX-100'
            points: 0
        }
        {
            name: 'Phantom II'
            id: 59
            ship: 'Sheathipede-class Shuttle'
            points: 0
        }
        {
            name: 'First Order Vanguard'
            id: 60
            ship: 'TIE Silencer'
            unique: true
            points: 2
        }
    ]

    conditionsById: [
        {
            name: '''Zero Condition'''
            id: 0
        }
        {
            name: '''I'll Show You the Dark Side'''
            id: 1
            unique: true
        }
        {
            name: 'A Debt to Pay'
            id: 2
            unique: true
        }
        {
            name: 'Suppressive Fire'
            id: 3
            unique: true
        }
        {
            name: '''Fanatical Devotion'''
            id: 4
            unique: true
        }
        {
            name: 'Shadowed'
            id: 5
            unique: true
        }
        {
            name: 'Mimicked'
            id: 6
            unique: true
        }
        {
            name: 'Harpooned!'
            id: 7
        }
        {
            name: 'Rattled'
            id: 8
            unique: true
        }
    ]

exportObj.setupCardData = (basic_cards, pilot_translations, upgrade_translations, modification_translations, title_translations, condition_translations) ->
    # assert that each ID is the index into BLAHById (should keep this, in general)
    for pilot_data, i in basic_cards.pilotsById
        if pilot_data.id != i
            throw new Error("ID mismatch: pilot at index #{i} has ID #{pilot_data.id}")
    for upgrade_data, i in basic_cards.upgradesById
        if upgrade_data.id != i
            throw new Error("ID mismatch: upgrade at index #{i} has ID #{upgrade_data.id}")
    for title_data, i in basic_cards.titlesById
        if title_data.id != i
            throw new Error("ID mismatch: title at index #{i} has ID #{title_data.id}")
    for modification_data, i in basic_cards.modificationsById
        if modification_data.id != i
            throw new Error("ID mismatch: modification at index #{i} has ID #{modification_data.id}")
    for condition_data, i in basic_cards.conditionsById
        if condition_data.id != i
            throw new Error("ID mismatch: condition at index #{i} has ID #{condition_data.id}")

    exportObj.pilots = {}
    # Assuming a given pilot is unique by name...
    for pilot_data in basic_cards.pilotsById
        unless pilot_data.skip?
            pilot_data.sources = []
            pilot_data.english_name = pilot_data.name
            pilot_data.english_ship = pilot_data.ship
            pilot_data.canonical_name = pilot_data.english_name.canonicalize() unless pilot_data.canonical_name?
            exportObj.pilots[pilot_data.name] = pilot_data
    # pilot_name is the English version here as it's the common index into
    # basic card info
    for pilot_name, translations of pilot_translations
        for field, translation of translations
            try
                exportObj.pilots[pilot_name][field] = translation
            catch e
                console.error "[pilot_data] Cannot find translation for attribute #{field} for pilot #{pilot_name}"
                throw e

    exportObj.upgrades = {}
    for upgrade_data in basic_cards.upgradesById
        unless upgrade_data.skip?
            upgrade_data.sources = []
            upgrade_data.english_name = upgrade_data.name
            upgrade_data.canonical_name = upgrade_data.english_name.canonicalize() unless upgrade_data.canonical_name?
            exportObj.upgrades[upgrade_data.name] = upgrade_data
    for upgrade_name, translations of upgrade_translations
        for field, translation of translations
            try
                exportObj.upgrades[upgrade_name][field] = translation
            catch e
                console.error "[upgrade_data] Cannot find translation for attribute #{field} for upgrade #{upgrade_name}"
                throw e

    exportObj.modifications = {}
    for modification_data in basic_cards.modificationsById
        unless modification_data.skip?
            modification_data.sources = []
            modification_data.english_name = modification_data.name
            modification_data.canonical_name = modification_data.english_name.canonicalize() unless modification_data.canonical_name?
            exportObj.modifications[modification_data.name] = modification_data
    for modification_name, translations of modification_translations
        for field, translation of translations
            try
                exportObj.modifications[modification_name][field] = translation
            catch e
                console.error "[modification_data] Cannot find translation for attribute #{field} for modification #{modification_name}"
                throw e

    exportObj.titles = {}
    for title_data in basic_cards.titlesById
        unless title_data.skip?
            title_data.sources = []
            title_data.english_name = title_data.name
            title_data.canonical_name = title_data.english_name.canonicalize() unless title_data.canonical_name?
            exportObj.titles[title_data.name] = title_data
    for title_name, translations of title_translations
        for field, translation of translations
            try
                exportObj.titles[title_name][field] = translation
            catch e
                console.error "[title_data] Cannot find translation for attribute #{field} for title #{title_name}"
                throw e

    exportObj.conditions = {}
    for condition_data in basic_cards.conditionsById
        unless condition_data.skip?
            condition_data.sources = []
            condition_data.english_name = condition_data.name
            condition_data.canonical_name = condition_data.english_name.canonicalize() unless condition_data.canonical_name?
            exportObj.conditions[condition_data.name] = condition_data
    for condition_name, translations of condition_translations
        for field, translation of translations
            try
                exportObj.conditions[condition_name][field] = translation
            catch e
                console.error "[condition_data]Cannot find translation for attribute #{field} for condition #{condition_name}"
                throw e

    for ship_name, ship_data of basic_cards.ships
        ship_data.english_name ?= ship_name
        ship_data.canonical_name ?= ship_data.english_name.canonicalize()

    # Set sources from manifest
    for expansion, cards of exportObj.manifestByExpansion
        for card in cards
            continue if card.skipForSource # heavy scyk special case :(
            try
                switch card.type
                    when 'pilot'
                        exportObj.pilots[card.name].sources.push expansion
                    when 'upgrade'
                        exportObj.upgrades[card.name].sources.push expansion
                    when 'modification'
                        exportObj.modifications[card.name].sources.push expansion
                    when 'title'
                        exportObj.titles[card.name].sources.push expansion
                    when 'ship'
                        # Not used for sourcing
                        ''
                    else
                        throw new Error("Unexpected card type #{card.type} for card #{card.name} of #{expansion}")
            catch e
                console.error "Error adding card #{card.name} (#{card.type}) from #{expansion}"

    for name, card of exportObj.pilots
        card.sources = card.sources.sort()
    for name, card of exportObj.upgrades
        card.sources = card.sources.sort()
    for name, card of exportObj.modifications
        card.sources = card.sources.sort()
    for name, card of exportObj.titles
        card.sources = card.sources.sort()

    exportObj.expansions = {}

    exportObj.pilotsById = {}
    exportObj.pilotsByLocalizedName = {}
    for pilot_name, pilot of exportObj.pilots
        exportObj.fixIcons pilot
        exportObj.pilotsById[pilot.id] = pilot
        exportObj.pilotsByLocalizedName[pilot.name] = pilot
        for source in pilot.sources
            exportObj.expansions[source] = 1 if source not of exportObj.expansions
    if Object.keys(exportObj.pilotsById).length != Object.keys(exportObj.pilots).length
        throw new Error("At least one pilot shares an ID with another")

    exportObj.pilotsByFactionCanonicalName = {}
    # uniqueness can't be enforced just be canonical name, but by the base part
    exportObj.pilotsByUniqueName = {}
    for pilot_name, pilot of exportObj.pilots
        ((exportObj.pilotsByFactionCanonicalName[pilot.faction] ?= {})[pilot.canonical_name] ?= []).push pilot
        (exportObj.pilotsByUniqueName[pilot.canonical_name.getXWSBaseName()] ?= []).push pilot
        # Hack until we need to disambiguate same name pilots by subfaction
        switch pilot.faction
            when 'Resistance'
                ((exportObj.pilotsByFactionCanonicalName['Rebel Alliance'] ?= {})[pilot.canonical_name] ?= []).push pilot
            when 'First Order'
                ((exportObj.pilotsByFactionCanonicalName['Galactic Empire'] ?= {})[pilot.canonical_name] ?= []).push pilot

    exportObj.upgradesById = {}
    exportObj.upgradesByLocalizedName = {}
    for upgrade_name, upgrade of exportObj.upgrades
        exportObj.fixIcons upgrade
        exportObj.upgradesById[upgrade.id] = upgrade
        exportObj.upgradesByLocalizedName[upgrade.name] = upgrade
        for source in upgrade.sources
            exportObj.expansions[source] = 1 if source not of exportObj.expansions
    if Object.keys(exportObj.upgradesById).length != Object.keys(exportObj.upgrades).length
        throw new Error("At least one upgrade shares an ID with another")

    exportObj.upgradesBySlotCanonicalName = {}
    exportObj.upgradesBySlotUniqueName = {}
    for upgrade_name, upgrade of exportObj.upgrades
        (exportObj.upgradesBySlotCanonicalName[upgrade.slot] ?= {})[upgrade.canonical_name] = upgrade
        (exportObj.upgradesBySlotUniqueName[upgrade.slot] ?= {})[upgrade.canonical_name.getXWSBaseName()] = upgrade

    exportObj.modificationsById = {}
    exportObj.modificationsByLocalizedName = {}
    for modification_name, modification of exportObj.modifications
        exportObj.fixIcons modification
        # Modifications cannot be added to huge ships unless specifically allowed
        if modification.huge?
            unless modification.restriction_func?
                modification.restriction_func = exportObj.hugeOnly
        else unless modification.restriction_func?
            modification.restriction_func = (ship) ->
                not (ship.data.huge ? false)
        exportObj.modificationsById[modification.id] = modification
        exportObj.modificationsByLocalizedName[modification.name] = modification
        for source in modification.sources
            exportObj.expansions[source] = 1 if source not of exportObj.expansions
    if Object.keys(exportObj.modificationsById).length != Object.keys(exportObj.modifications).length
        throw new Error("At least one modification shares an ID with another")

    exportObj.modificationsByCanonicalName = {}
    exportObj.modificationsByUniqueName = {}
    for modification_name, modification of exportObj.modifications
        (exportObj.modificationsByCanonicalName ?= {})[modification.canonical_name] = modification
        (exportObj.modificationsByUniqueName ?= {})[modification.canonical_name.getXWSBaseName()] = modification

    exportObj.titlesById = {}
    exportObj.titlesByLocalizedName = {}
    for title_name, title of exportObj.titles
        exportObj.fixIcons title
        exportObj.titlesById[title.id] = title
        exportObj.titlesByLocalizedName[title.name] = title
        for source in title.sources
            exportObj.expansions[source] = 1 if source not of exportObj.expansions
    if Object.keys(exportObj.titlesById).length != Object.keys(exportObj.titles).length
        throw new Error("At least one title shares an ID with another")

    exportObj.conditionsById = {}
    for condition_name, condition of exportObj.conditions
        exportObj.fixIcons condition
        exportObj.conditionsById[condition.id] = condition
        for source in condition.sources
            exportObj.expansions[source] = 1 if source not of exportObj.expansions
    if Object.keys(exportObj.conditionsById).length != Object.keys(exportObj.conditions).length
        throw new Error("At least one condition shares an ID with another")

    exportObj.titlesByShip = {}
    for title_name, title of exportObj.titles
        if title.ship not of exportObj.titlesByShip
            exportObj.titlesByShip[title.ship] = []
        exportObj.titlesByShip[title.ship].push title

    exportObj.titlesByCanonicalName = {}
    exportObj.titlesByUniqueName = {}
    for title_name, title of exportObj.titles
        # Special cases :(
        if title.canonical_name == '"Heavy Scyk" Interceptor'.canonicalize()
            ((exportObj.titlesByCanonicalName ?= {})[title.canonical_name] ?= []).push title
            ((exportObj.titlesByUniqueName ?= {})[title.canonical_name.getXWSBaseName()] ?= []).push title
        else
            (exportObj.titlesByCanonicalName ?= {})[title.canonical_name] = title
            (exportObj.titlesByUniqueName ?= {})[title.canonical_name.getXWSBaseName()] = title

    exportObj.conditionsByCanonicalName = {}
    for condition_name, condition of exportObj.conditions
        (exportObj.conditionsByCanonicalName ?= {})[condition.canonical_name] = condition

    exportObj.expansions = Object.keys(exportObj.expansions).sort()

exportObj.fixIcons = (data) ->
    if data.text?
        data.text = data.text
            .replace(/%ASTROMECH%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-astromech"></i>')
            .replace(/%BANKLEFT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-bankleft"></i>')
            .replace(/%BANKRIGHT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-bankright"></i>')
            .replace(/%BARRELROLL%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-barrelroll"></i>')
            .replace(/%BOMB%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-bomb"></i>')
            .replace(/%BOOST%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-boost"></i>')
            .replace(/%CANNON%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-cannon"></i>')
            .replace(/%CARGO%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-cargo"></i>')
            .replace(/%CLOAK%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-cloak"></i>')
            .replace(/%COORDINATE%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-coordinate"></i>')
            .replace(/%CRIT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-crit"></i>')
            .replace(/%CREW%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-crew"></i>')
            .replace(/%DUALCARD%/g, '<span class="card-restriction">Dual card.</span>')
            .replace(/%ELITE%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-elite"></i>')
            .replace(/%EVADE%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-evade"></i>')
            .replace(/%FOCUS%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-focus"></i>')
            .replace(/%HARDPOINT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-hardpoint"></i>')
            .replace(/%HIT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-hit"></i>')
            .replace(/%ILLICIT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-illicit"></i>')
            .replace(/%JAM%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-jam"></i>')
            .replace(/%KTURN%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-kturn"></i>')
            .replace(/%MISSILE%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-missile"></i>')
            .replace(/%RECOVER%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-recover"></i>')
            .replace(/%REINFORCE%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-reinforce"></i>')
            .replace(/%SALVAGEDASTROMECH%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-salvagedastromech"></i>')
            .replace(/%SLAM%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-slam"></i>')
            .replace(/%SLOOPLEFT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-sloopleft"></i>')
            .replace(/%SLOOPRIGHT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-sloopright"></i>')
            .replace(/%STRAIGHT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-straight"></i>')
            .replace(/%STOP%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-stop"></i>')
            .replace(/%SYSTEM%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-system"></i>')
            .replace(/%TARGETLOCK%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-targetlock"></i>')
            .replace(/%TEAM%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-team"></i>')
            .replace(/%TECH%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-tech"></i>')
            .replace(/%TORPEDO%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-torpedo"></i>')
            .replace(/%TROLLLEFT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-trollleft"></i>')
            .replace(/%TROLLRIGHT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-trollright"></i>')
            .replace(/%TURNLEFT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-turnleft"></i>')
            .replace(/%TURNRIGHT%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-turnright"></i>')
            .replace(/%TURRET%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-turret"></i>')
            .replace(/%UTURN%/g, '<i class="xwing-miniatures-font xwing-miniatures-font-kturn"></i>')
            .replace(/%HUGESHIPONLY%/g, '<span class="card-restriction">Huge ship only.</span>')
            .replace(/%LARGESHIPONLY%/g, '<span class="card-restriction">Large ship only.</span>')
            .replace(/%SMALLSHIPONLY%/g, '<span class="card-restriction">Small ship only.</span>')
            .replace(/%REBELONLY%/g, '<span class="card-restriction">Rebel only.</span>')
            .replace(/%IMPERIALONLY%/g, '<span class="card-restriction">Imperial only.</span>')
            .replace(/%SCUMONLY%/g, '<span class="card-restriction">Scum only.</span>')
            .replace(/%LIMITED%/g, '<span class="card-restriction">Limited.</span>')
            .replace(/%LINEBREAK%/g, '<br /><br />')
            .replace(/%DE_HUGESHIPONLY%/g, '<span class="card-restriction">Nur für riesige Schiffe.</span>')
            .replace(/%DE_LARGESHIPONLY%/g, '<span class="card-restriction">Nur für grosse Schiffe.</span>')
            .replace(/%DE_REBELONLY%/g, '<span class="card-restriction">Nur für Rebellen.</span>')
            .replace(/%DE_IMPERIALONLY%/g, '<span class="card-restriction">Nur für das Imperium.</span>')
            .replace(/%DE_SCUMONLY%/g, '<span class="card-restriction">Nur für Abschaum & Kriminelle.</span>')
            .replace(/%DE_GOZANTIONLY%/g, '<span class="card-restriction">Nur für Kreuzer der <em>Gozanti</em>-Klasse.</span>')
            .replace(/%DE_LIMITED%/g, '<span class="card-restriction">Limitiert.</span>')
            .replace(/%DE_SMALLSHIPONLY%/g, '<span class="card-restriction">Nur für kleine Schiffe.</span>')
            .replace(/%FR_HUGESHIPONLY%/g, '<span class="card-restriction">Vaisseau immense uniquement.</span>')
            .replace(/%FR_LARGESHIPONLY%/g, '<span class="card-restriction">Grand vaisseau uniquement.</span>')
            .replace(/%FR_REBELONLY%/g, '<span class="card-restriction">Rebelle uniquement.</span>')
            .replace(/%FR_IMPERIALONLY%/g, '<span class="card-restriction">Impérial uniquement.</span>')
            .replace(/%FR_SCUMONLY%/g, '<span class="card-restriction">Racailles uniquement.</span>')
            .replace(/%GOZANTIONLY%/g, '<span class="card-restriction"><em>Gozanti</em>-class cruiser only.</span>')

exportObj.canonicalizeShipNames = (card_data) ->
    for ship_name, ship_data of card_data.ships
        ship_data.english_name = ship_name
        ship_data.canonical_name ?= ship_data.english_name.canonicalize()

exportObj.renameShip = (english_name, new_name) ->
    exportObj.ships[new_name] = exportObj.ships[english_name]
    exportObj.ships[new_name].name = new_name
    exportObj.ships[new_name].english_name = english_name
    delete exportObj.ships[english_name]

exportObj = exports ? this

exportObj.codeToLanguage ?= {}
exportObj.codeToLanguage.en = 'English'

exportObj.translations ?= {}
# This is here mostly as a template for other languages.
exportObj.translations.English =
    action:
        "Barrel Roll": "Barrel Roll"
        "Boost": "Boost"
        "Evade": "Evade"
        "Focus": "Focus"
        "Target Lock": "Target Lock"
        "Recover": "Recover"
        "Reinforce": "Reinforce"
        "Jam": "Jam"
        "Coordinate": "Coordinate"
        "Cloak": "Cloak"
        "SLAM": "SLAM"
    slot:
        "Astromech": "Astromech"
        "Bomb": "Bomb"
        "Cannon": "Cannon"
        "Crew": "Crew"
        "Elite": "Elite"
        "Missile": "Missile"
        "System": "System"
        "Torpedo": "Torpedo"
        "Turret": "Turret"
        "Cargo": "Cargo"
        "Hardpoint": "Hardpoint"
        "Team": "Team"
        "Illicit": "Illicit"
        "Salvaged Astromech": "Salvaged Astromech"
    sources: # needed?
        "Core": "Core"
        "A-Wing Expansion Pack": "A-Wing Expansion Pack"
        "B-Wing Expansion Pack": "B-Wing Expansion Pack"
        "X-Wing Expansion Pack": "X-Wing Expansion Pack"
        "Y-Wing Expansion Pack": "Y-Wing Expansion Pack"
        "Millennium Falcon Expansion Pack": "Millennium Falcon Expansion Pack"
        "HWK-290 Expansion Pack": "HWK-290 Expansion Pack"
        "TIE Fighter Expansion Pack": "TIE Fighter Expansion Pack"
        "TIE Interceptor Expansion Pack": "TIE Interceptor Expansion Pack"
        "TIE Bomber Expansion Pack": "TIE Bomber Expansion Pack"
        "TIE Advanced Expansion Pack": "TIE Advanced Expansion Pack"
        "Lambda-Class Shuttle Expansion Pack": "Lambda-Class Shuttle Expansion Pack"
        "Slave I Expansion Pack": "Slave I Expansion Pack"
        "Imperial Aces Expansion Pack": "Imperial Aces Expansion Pack"
        "Rebel Transport Expansion Pack": "Rebel Transport Expansion Pack"
        "Z-95 Headhunter Expansion Pack": "Z-95 Headhunter Expansion Pack"
        "TIE Defender Expansion Pack": "TIE Defender Expansion Pack"
        "E-Wing Expansion Pack": "E-Wing Expansion Pack"
        "TIE Phantom Expansion Pack": "TIE Phantom Expansion Pack"
        "Tantive IV Expansion Pack": "Tantive IV Expansion Pack"
        "Rebel Aces Expansion Pack": "Rebel Aces Expansion Pack"
        "YT-2400 Freighter Expansion Pack": "YT-2400 Freighter Expansion Pack"
        "VT-49 Decimator Expansion Pack": "VT-49 Decimator Expansion Pack"
        "StarViper Expansion Pack": "StarViper Expansion Pack"
        "M3-A Interceptor Expansion Pack": "M3-A Interceptor Expansion Pack"
        "IG-2000 Expansion Pack": "IG-2000 Expansion Pack"
        "Most Wanted Expansion Pack": "Most Wanted Expansion Pack"
        "Imperial Raider Expansion Pack": "Imperial Raider Expansion Pack"
        "Hound's Tooth Expansion Pack": "Hound's Tooth Expansion Pack"
        "Kihraxz Fighter Expansion Pack": "Kihraxz Fighter Expansion Pack"
        "K-Wing Expansion Pack": "K-Wing Expansion Pack"
        "TIE Punisher Expansion Pack": "TIE Punisher Expansion Pack"
        "The Force Awakens Core Set": "The Force Awakens Core Set"
    ui:
        shipSelectorPlaceholder: "Select a ship"
        pilotSelectorPlaceholder: "Select a pilot"
        upgradePlaceholder: (translator, language, slot) ->
            "No #{translator language, 'slot', slot} Upgrade"
        modificationPlaceholder: "No Modification"
        titlePlaceholder: "No Title"
        upgradeHeader: (translator, language, slot) ->
            "#{translator language, 'slot', slot} Upgrade"
        unreleased: "unreleased"
        epic: "epic"
        limited: "limited"
    byCSSSelector:
        # Warnings
        '.unreleased-content-used .translated': 'This squad uses unreleased content!'
        '.epic-content-used .translated': 'This squad uses Epic content!'
        '.illegal-epic-too-many-small-ships .translated': 'You may not field more than 12 of the same type Small ship!'
        '.illegal-epic-too-many-large-ships .translated': 'You may not field more than 6 of the same type Large ship!'
        '.collection-invalid .translated': 'You cannot field this list with your collection!'
        # Type selector
        '.game-type-selector option[value="standard"]': 'Standard'
        '.game-type-selector option[value="custom"]': 'Custom'
        '.game-type-selector option[value="epic"]': 'Epic'
        '.game-type-selector option[value="team-epic"]': 'Team Epic'
        # Card browser
        '.xwing-card-browser option[value="name"]': 'Name'
        '.xwing-card-browser option[value="source"]': 'Source'
        '.xwing-card-browser option[value="type-by-points"]': 'Type (by Points)'
        '.xwing-card-browser option[value="type-by-name"]': 'Type (by Name)'
        '.xwing-card-browser .translate.select-a-card': 'Select a card from the list at the left.'
        '.xwing-card-browser .translate.sort-cards-by': 'Sort cards by'
        # Info well
        '.info-well .info-ship td.info-header': 'Ship'
        '.info-well .info-skill td.info-header': 'Skill'
        '.info-well .info-actions td.info-header': 'Actions'
        '.info-well .info-upgrades td.info-header': 'Upgrades'
        '.info-well .info-range td.info-header': 'Range'
        # Squadron edit buttons
        '.clear-squad' : 'New Squad'
        '.save-list' : 'Save'
        '.save-list-as' : 'Save as…'
        '.delete-list' : 'Delete'
        '.backend-list-my-squads' : 'Load squad'
        '.view-as-text' : '<span class="hidden-phone"><i class="fa fa-print"></i>&nbsp;Print/View as </span>Text'
        '.randomize' : 'Random!'
        '.randomize-options' : 'Randomizer options…'
        '.notes-container > span' : 'Squad Notes'
        # Print/View modal
        '.bbcode-list' : 'Copy the BBCode below and paste it into your forum post.<textarea></textarea><button class="btn btn-copy">Copy</button>'
        '.html-list' : '<textarea></textarea><button class="btn btn-copy">Copy</button>'
        '.vertical-space-checkbox' : """Add space for damage/upgrade cards when printing <input type="checkbox" class="toggle-vertical-space" />"""
        '.color-print-checkbox' : """Print color <input type="checkbox" class="toggle-color-print" />"""
        '.print-list' : '<i class="fa fa-print"></i>&nbsp;Print'
        # Randomizer options
        '.do-randomize' : 'Randomize!'
        # Top tab bar
        '#empireTab' : 'Galactic Empire'
        '#rebelTab' : 'Rebel Alliance'
        '#scumTab' : 'Scum and Villainy'
        #'#browserTab' : 'Card Browser'
        '#aboutTab' : 'About'
        # Obstacles
        '.choose-obstacles' : 'Choose Obstacles'
        '.choose-obstacles-description' : 'Choose up to three obstacles to include in the permalink for use in external programs. (This feature is in BETA; support for displaying which obstacles were selected in the printout is not yet supported.)'
        '.coreasteroid0-select' : 'Core Asteroid 0'
        '.coreasteroid1-select' : 'Core Asteroid 1'
        '.coreasteroid2-select' : 'Core Asteroid 2'
        '.coreasteroid3-select' : 'Core Asteroid 3'
        '.coreasteroid4-select' : 'Core Asteroid 4'
        '.coreasteroid5-select' : 'Core Asteroid 5'
        '.yt2400debris0-select' : 'YT2400 Debris 0'
        '.yt2400debris1-select' : 'YT2400 Debris 1'
        '.yt2400debris2-select' : 'YT2400 Debris 2'
        '.vt49decimatordebris0-select' : 'VT49 Debris 0'
        '.vt49decimatordebris1-select' : 'VT49 Debris 1'
        '.vt49decimatordebris2-select' : 'VT49 Debris 2'
        '.core2asteroid0-select' : 'Force Awakens Asteroid 0'
        '.core2asteroid1-select' : 'Force Awakens Asteroid 1'
        '.core2asteroid2-select' : 'Force Awakens Asteroid 2'
        '.core2asteroid3-select' : 'Force Awakens Asteroid 3'
        '.core2asteroid4-select' : 'Force Awakens Asteroid 4'
        '.core2asteroid5-select' : 'Force Awakens Asteroid 5'

    singular:
        'pilots': 'Pilot'
        'modifications': 'Modification'
        'titles': 'Title'
    types:
        'Pilot': 'Pilot'
        'Modification': 'Modification'
        'Title': 'Title'

exportObj.cardLoaders ?= {}
exportObj.cardLoaders.English = () ->
    exportObj.cardLanguage = 'English'

    # Assumes cards-common has been loaded
    basic_cards = exportObj.basicCardData()
    exportObj.canonicalizeShipNames basic_cards

    # English names are loaded by default, so no update is needed
    exportObj.ships = basic_cards.ships

    # Names don't need updating, but text needs to be set
    pilot_translations =
        "Wedge Antilles":
            text: """When attacking, reduce the defender's agility value by 1 (to a minimum of "0")."""
        "Garven Dreis":
            text: """After spending a focus token, you may place that token on any other friendly ship at Range 1-2 (instead of discarding it)."""
        "Biggs Darklighter":
            text: """Other friendly ships at Range 1 cannot be targeted by attacks if the attacker could target you instead."""
        "Luke Skywalker":
            text: """When defending, you may change 1 of your %FOCUS% results to a %EVADE% result."""
        '"Dutch" Vander':
            text: """After acquiring a target lock, choose another friendly ship at Range 1-2.  The chosen ship may immediately acquire a target lock."""
        "Horton Salm":
            text: """When attacking at Range 2-3, you may reroll any of your blank results."""
        '"Winged Gundark"':
            text: """When attacking at Range 1, you may change 1 of your %HIT% results to a %CRIT% result."""
        '"Night Beast"':
            text: """After executing a green maneuver, you may perform a free focus action."""
        '"Backstabber"':
            text: """When attacking from outside the defender's firing arc, roll 1 additional attack die."""
        '"Dark Curse"':
            text: """When defending, ships attacking you cannot spend focus tokens or reroll attack dice."""
        '"Mauler Mithel"':
            text: """When attacking at Range 1, roll 1 additional attack die."""
        '"Howlrunner"':
            text: """When another friendly ship at Range 1 is attacking with its primary weapon, it may reroll 1 attack die."""
        "Maarek Stele":
            text: """When your attack deals a faceup Damage card to the defender, instead draw 3 Damage cards, choose 1 to deal, and discard the others."""
        "Darth Vader":
            text: """During your "Perform Action" step, you may perform 2 actions."""
        "\"Fel's Wrath\"":
            text: """When the number of Damage cards assigned to you equals or exceeds your hull value, you are not destroyed until the end of the Combat phase."""
        "Turr Phennir":
            text: """After you perform an attack, you may perform a free boost or barrel roll action."""
        "Soontir Fel":
            text: """When you receive a stress token, you may assign 1 focus token to your ship."""
        "Tycho Celchu":
            text: """You may perform actions even while you have stress tokens."""
        "Arvel Crynyd":
            text: """You may declare an enemy ship inside your firing arc that you are touching as the target of your attack."""
        "Chewbacca":
            text: """When you are dealt a faceup Damage card, immediately flip it facedown (without resolving its ability)."""
        "Lando Calrissian":
            text: """After you execute a green maneuver, choose 1 other friendly ship at Range 1.  That ship may perform 1 free action shown on its action bar."""
        "Han Solo":
            text: """When attacking, you may reroll all of your dice.  If you choose to do so, you must reroll as many of your dice as possible."""
        "Kath Scarlet":
            text: """When attacking, the defender receives 1 stress token if he cancels at least 1 %CRIT% result."""
        "Boba Fett":
            text: """When you reveal a bank maneuver (%BANKLEFT% or %BANKRIGHT%), you may rotate your dial to the other bank maneuver of the same speed."""
        "Krassis Trelix":
            text: """When attacking with a secondary weapon, you may reroll 1 attack die."""
        "Ten Numb":
            text: """When attacking, 1 of your %CRIT% results cannot be canceled by defense dice."""
        "Ibtisam":
            text: """When attacking or defending, if you have at least 1 stress token, you may reroll 1 of your dice."""
        "Roark Garnet":
            text: '''At the start of the Combat phase, choose 1 other friendly ship at Range 1-3.  Until the end of the phase, treat that ship's pilot skill value as "12."'''
        "Kyle Katarn":
            text: """At the start of the Combat phase, you may assign 1 of your focus tokens to another friendly ship at Range 1-3."""
        "Jan Ors":
            text: """When another friendly ship at Range 1-3 is attacking, if you have no stress tokens, you may receive 1 stress token to allow that ship to roll 1 additional attack die."""
        "Captain Jonus":
            text: """When another friendly ship at Range 1 attacks with a secondary weapon, it may reroll up to 2 attack dice."""
        "Major Rhymer":
            text: """When attacking with a secondary weapon, you may increase or decrease the weapon range by 1 to a limit of Range 1-3."""
        "Captain Kagi":
            text: """When an enemy ship acquires a target lock, it must lock onto your ship if able."""
        "Colonel Jendon":
            text: """At the start of the Combat phase, you may assign 1 of your blue target lock tokens to a friendly ship at Range 1 if it does not have a blue target lock token."""
        "Captain Yorr":
            text: """When another friendly ship at Range 1-2 would receive a stress token, if you have 2 or fewer stress tokens, you may receive that token instead."""
        "Lieutenant Lorrir":
            text: """When performing a barrel roll action, you may receive 1 stress token to use the (%BANKLEFT% 1) or (%BANKRIGHT% 1) template instead of the (%STRAIGHT% 1) template."""
        "Tetran Cowall":
            text: """When you reveal a %UTURN% maneuver, you may treat the speed of that maneuver as "1," "3," or "5"."""
        "Kir Kanos":
            text: """When attacking at Range 2-3, you may spend 1 evade token to add 1 %HIT% result to your roll."""
        "Carnor Jax":
            text: """Enemy ships at Range 1 cannot perform focus or evade actions and cannot spend focus or evade tokens."""
        "Lieutenant Blount":
            text: """When attacking, the defender is hit by your attack, even if he does not suffer any damage."""
        "Airen Cracken":
            text: """After you perform an attack, you may choose another friendly ship at Range 1.  That ship may perform 1 free action."""
        "Colonel Vessery":
            text: """When attacking, immediately after you roll attack dice, you may acquire a target lock on the defender if it already has a red target lock token."""
        "Rexler Brath":
            text: """After you perform an attack that deals at least 1 Damage card to the defender, you may spend a focus token to flip those cards faceup."""
        "Etahn A'baht":
            text: """When an enemy ship inside your firing arc at Range 1-3 is defending, the attacker may change 1 of its %HIT% results to a %CRIT% result."""
        "Corran Horn":
            text: """At the start of the End phase, you may perform one attack.  You cannot attack during the next round."""
        '"Echo"':
            text: """When you decloak, you must use the (%BANKLEFT% 2) or (%BANKRIGHT% 2) template instead of the (%STRAIGHT% 2) template."""
        '"Whisper"':
            text: """After you perform an attack that hits, you may assign 1 focus to your ship."""
        "Wes Janson":
            text: """After you perform an attack, you may remove 1 focus, evade, or blue target lock token from the defender."""
        "Jek Porkins":
            text: """When you receive a stress token, you may remove it and roll 1 attack die.  On a %HIT% result, deal 1 facedown Damage card to this ship."""
        '"Hobbie" Klivian':
            text: """When you acquire or spend a target lock, you may remove 1 stress token from your ship."""
        "Tarn Mison":
            text: """When an enemy ship declares you as the target of an attack, you may acquire a target lock on that ship."""
        "Jake Farrell":
            text: """After you perform a focus action or are assigned a focus token, you may perform a free boost or barrel roll action."""
        "Gemmer Sojan":
            text: """While you are at Range 1 of at least 1 enemy ship, increase your agility value by 1."""
        "Keyan Farlander":
            text: """When attacking, you may remove 1 stress token to change all of your %FOCUS% results to %HIT%results."""
        "Nera Dantels":
            text: """You can perform %TORPEDO% secondary weapon attacks against enemy ships outside your firing arc."""
        "CR90 Corvette (Fore)":
            text: """When attacking with your primary weapon, you may spend 1 energy to roll 1 additional attack die."""
        # "CR90 Corvette (Crippled Aft)":
        #     text: """You cannot choose or execute (%STRAIGHT% 4), (%BANKLEFT% 2), or (%BANKRIGHT% 2) maneuvers."""
        "Dash Rendar":
            text: """You may ignore obstacles during the Activation phase and when performing actions."""
        '"Leebo"':
            text: """When you are dealt a faceup Damage card, draw 1 additional Damage card, choose 1 to resolve, and discard the other."""
        "Eaden Vrill":
            text: """When performing a primary weapon attack against a stressed ship, roll 1 additional attack die."""
        "Rear Admiral Chiraneau":
            text: """When attacking at Range 1-2, you may change 1 of your %FOCUS% results to a %CRIT% result."""
        "Commander Kenkirk":
            text: """If you have no shields and at least 1 Damage card assigned to you, increase your agility value by 1."""
        "Captain Oicunn":
            text: """After executing a maneuver, each enemy ship you are touching suffers 1 damage."""
        "Prince Xizor":
            text: """When defending, a friendly ship at Range 1 may suffer 1 uncanceled %HIT% or %CRIT% result instead of you."""
        "Guri":
            text: """At the start of the Combat phase, if you are at Range 1 of an enemy ship, you may assign 1 focus token to your ship."""
        "Serissu":
            text: """When another friendly ship at Range 1 is defending, it may reroll 1 defense die."""
        "Laetin A'shera":
            text: """After you defend against an attack, if the attack did not hit, you may assign 1 evade token to your ship."""
        "IG-88A":
            text: """After you perform an attack that destroys the defender, you may recover 1 shield."""
        "IG-88B":
            text: """Once per round, after you perform an attack that does not hit, you may perform an attack with an equipped %CANNON% secondary weapon."""
        "IG-88C":
            text: """After you perform a boost action, you may perform a free evade action."""
        "IG-88D":
            text: """You may execute the (%SLOOPLEFT% 3) or (%SLOOPRIGHT% 3) maneuver using the corresponding (%TURNLEFT% 3) or (%TURNRIGHT% 3) template."""
        "Boba Fett (Scum)":
            text: """When attacking or defending, you may reroll 1 of your dice for each enemy ship at Range 1."""
        "Kath Scarlet (Scum)":
            text: """When attacking a ship inside your auxiliary firing arc, roll 1 additional attack die."""
        "Emon Azzameen":
            text: """When dropping a bomb, you may use the (%TURNLEFT% 3), (%STRAIGHT% 3), or (%TURNRIGHT% 3) template instead of the (%STRAIGHT% 1) template."""
        "Kavil":
            text: """When attacking a ship outside your firing arc, roll 1 additional attack die."""
        "Drea Renthal":
            text: """After you spend a target lock, you may receive 1 stress token to acquire a target lock."""
        "Dace Bonearm":
            text: """When an enemy ship at Range 1-3 receives at least 1 ion token, if you are not stressed, you may receive 1 stress token to cause that ship to suffer 1 damage."""
        "Palob Godalhi":
            text: """At the start of the Combat phase, you may remove 1 focus or evade token from an enemy ship at Range 1-2 and assign it to yourself."""
        "Torkil Mux":
            text: """At the end of the Activation phase, choose 1 enemy ship at Range 1-2. Until the end of the Combat phase, treat that ship's pilot skill value as "0"."""
        "N'Dru Suhlak":
            text: """When attacking, if there are no other friendly ships at Range 1-2, roll 1 additional attack die."""
        "Kaa'to Leeachos":
            text: """At the start of the Combat phase, you may remove 1 focus or evade token from another friendly ship at Range 1-2 and assign it to yourself."""
        "Commander Alozen":
            text: """At the start of the Combat phase, you may acquire a target lock on an enemy ship at Range 1."""
        "Raider-class Corvette (Fore)":
            text: """Once per round, after you perform a primary weapon attack, you may spend 2 energy to perform another primary weapon attack."""
        "Bossk":
            text: """When you perform an attack that hits, before dealing damage, you may cancel 1 of your %CRIT% results to add 2 %HIT% results."""
        "Talonbane Cobra":
            text: """When attacking or defending, double the effect of your range combat bonuses."""
        "Miranda Doni":
            text: """Once per round when attacking, you may either spend 1 shield to roll 1 additional attack die <strong>or</strong> roll 1 fewer attack die to recover 1 shield."""
        '"Redline"':
            text: """You may maintain 2 target locks on the same ship.  When you acquire a target lock, you may acquire a second lock on that ship."""
        '"Deathrain"':
            text: """When dropping a bomb, you may use the front guides of your ship.  After dropping a bomb, you may perform a free barrel roll action."""
        "Juno Eclipse":
            text: """When you reveal your maneuver, you may increase or decrease its speed by 1 (to a minimum of 1)."""
        "Zertik Strom":
            text: """Enemy ships at Range 1 cannot add their range combat bonus when attacking."""
        "Lieutenant Colzet":
            text: """At the start of the End phase, you may spend a target lock you have on an enemy ship to flip 1 random facedown Damage card assigned to it faceup."""
        "Latts Razzi":
            text: """When a friendly ship declares an attack, you may spend a target lock you have on the defender to reduce its agility by 1 for that attack."""
        "Graz the Hunter":
            text: """When defending, if the attacker is inside your firing arc, roll 1 additional defense die."""
        "Esege Tuketu":
            text: """When another friendly ship at Range 1-2 is attacking, it may treat your focus tokens as its own."""
        "Moralo Eval":
            text: """You can perform %CANNON% secondary attacks against ships inside your auxiliary firing arc."""
        'Gozanti-class Cruiser':
            text: """After you execute a maneuver, you may deploy up to 2 attached ships."""
        '"Scourge"':
            text: """When attacking a defender that has 1 or more Damage cards, roll 1 additional attack die."""
        "The Inquisitor":
            text: """When attacking with your primary weapon at Range 2-3, treat the range of the attack as Range 1."""
        "Zuckuss":
            text: """When attacking, you may roll 1 additional attack die.  If you do, the defender rolls 1 additional defense die."""
        "Dengar":
            text: """Once per round after defending, if the attacker is inside your firing arc, you may perform an attack against that ship."""
        # T-70
        "Poe Dameron":
            text: """When attacking or defending, if you have a focus token, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result."""
        '"Blue Ace"':
            text: """When performing a boost action, you may use the (%TURNLEFT% 1) or (%TURNRIGHT% 1) template."""
        # TIE/fo
        '"Omega Ace"':
            text: """When attacking, you may spend a focus token and a target lock you have on the defender to change all of your results to %CRIT% results."""
        '"Epsilon Leader"':
            text: """At the start of the Combat phase, remove 1 stress token from each friendly ship at Range 1."""
        '"Zeta Ace"':
            text: """When performing a barrel roll you may use the (%STRAIGHT% 2) template instead of the (%STRAIGHT% 1) template."""
        '"Red Ace"':
            text: '''The first time you remove a shield token from your ship each round, assign 1 evade token to your ship.'''
        '"Omega Leader"':
            text: '''Enemy ships that you have locked cannot modify any dice when attacking you or defending against your attacks.'''
        'Hera Syndulla':
            text: '''When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty.'''
        '"Youngster"':
            text: """You may equip Action: EPTs. Friendly TIE fighters at range 1-3 may perform the action on your equipped EPT upgrade card."""
        '"Wampa"':
            text: """When attacking, you may cancel all die results.  If you cancel a %CRIT% result, deal 1 facedown Damage card to the defender."""
        '"Chaser"':
            text: """When another friendly ship at Range 1 spends a focus token, assign a focus token to your ship."""
        'Ezra Bridger':
            text: """When defending, if you are stressed, you may change up to 2 of your %FOCUS% results to %EVADE% results."""
        '"Zeta Leader"':
            text: '''When attacking, if you are not stressed, you may receive 1 stress token to roll 1 additional die.'''
        '"Epsilon Ace"':
            text: '''While you do not have any Damage cards, treat your pilot skill value as "12."'''
        "Kanan Jarrus":
            text: """When an enemy ship at Range 1-2 is attacking, you may spend a focus token.  If you do, the attacker rolls 1 fewer attack die."""
        '"Chopper"':
            text: """At the start of the Combat phase, each enemy ship you are touching receives 1 stress token."""
        'Hera Syndulla (Attack Shuttle)':
            text: """When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty."""
        'Sabine Wren':
            text: """Immediately before you reveal your maneuver, you may perform a free boost or barrel roll action."""
        '"Zeb" Orrelios':
            text: '''When defending, you may cancel %CRIT% results before %HIT% results.'''
        'Tomax Bren':
            text: '''You may equip discardable EPTs. Once per round after you discard an EPT upgrade card, flip that card faceup.'''
        'Ello Asty':
            text: '''While you are not stressed, you may treat your %TROLLLEFT% and %TROLLRIGHT% maneuvers as white maneuvers.'''
        "Valen Rudor":
            text: """After defending, you may perform a free action."""
        "4-LOM":
            text: """At the start of the End phase, you may assign 1 of your stress tokens to another ship at Range 1."""
        "Tel Trevura":
            text: """The first time you would be destroyed, instead cancel any remaining damage, discard all Damage cards, and deal 4 facedown Damage cards to this ship."""
        "Manaroo":
            text: """At the start of the Combat phase, you may assign all focus, evade, and target lock tokens assigned to you to another friendly ship at Range 1."""
        '"Deathfire"':
            text: '''When you reveal your maneuver dial or after you perform an action, you may perform a %BOMB% Upgrade card action as a free action.'''
        "Maarek Stele (TIE Defender)":
            text: """When your attack deals a faceup Damage card to the defender, instead draw 3 Damage cards, choose 1 to deal, and discard the others."""
        "Countess Ryad":
            text: """When you reveal a %STRAIGHT% maneuver, you may treat it as a %KTURN% maneuver."""
        "Poe Dameron (PS9)":
            text: """When attacking or defending, if you have a focus token, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result."""
        "Rey":
            text: """When attacking or defending, if the enemy ship is inside of your firing arc, you may reroll up to 2 of your blank results."""
        'Han Solo (TFA)':
            text: '''When you are placed during setup, you can be placed anywhere in the play area beyond Range 3 of enemy ships.'''
        'Chewbacca (TFA)':
            text: '''After another friendly ship at Range 1-3 is destroyed (but has not fled the battlefield), you may perform an attack.'''
        'Norra Wexley':
            text: '''When attacking or defending, you may spend a target lock you have on the enemy ship to add 1 %FOCUS% result to your roll.'''
        'Shara Bey':
            text: '''When another friendly ship at Range 1-2 is attacking, it may treat your blue target lock tokens as its own.'''
        'Thane Kyrell':
            text: '''After an enemy ship in your firing arc at Range 1-3 attacks another friendly ship, you may perform a free action.'''
        'Braylen Stramm':
            text: '''After you execute a maneuver, you may roll an attack die.  On a %HIT% or %CRIT% result, remove 1 stress token from your ship.'''
        '"Quickdraw"':
            text: '''Once per round, when you lose a shield token, you may perform a primary weapon attack.'''
        '"Backdraft"':
            text: '''When attacking a ship inside your auxiliary firing arc, you may add 1 %CRIT% result.'''
        'Fenn Rau':
            text: '''When attacking or defending, if the enemy ship is at Range 1, you may roll 1 additional die.'''
        'Old Teroch':
            text: '''At the start of the Combat phase, you may choose 1 enemy ship at Range 1.  If you are inside its firing arc, it discards all focus and evade tokens.'''
        'Kad Solus':
            text: '''After you execute a red maneuver, assign 2 focus tokens to your ship.'''
        'Ketsu Onyo':
            text: '''At the start of the Combat phase, you may choose a ship at Range 1.  If it is inside your primary <strong>and</strong> mobile firing arcs, assign 1 tractor beam token to it.'''
        'Asajj Ventress':
            text: '''At the start of the Combat phase, you may choose a ship at Range 1-2.  If it is inside your mobile firing arc, assign 1 stress token to it.'''
        'Sabine Wren (Scum)':
            text: '''When defending against an enemy ship inside your mobile firing arc at Range 1-2, you may add 1 %FOCUS% result to your roll.'''
        # Wave X
        'Sabine Wren (TIE Fighter)':
            text: '''Immediately before you reveal your maneuver, you may perform a free boost or barrel roll action.'''
        '"Zeb" Orrelios (TIE Fighter)':
            text: '''When defending, you may cancel %CRIT% results before %HIT% results.'''
        'Kylo Ren':
            text: '''The first time you are hit by an attack each round, deal the "I'll Show You the Dark Side" Condition card to the attacker.'''
        'Unkar Plutt':
            text: '''At the end of the Activation phase, you <strong>must</strong> assign a tractor beam token to each ship you are touching.'''
        'Cassian Andor':
            text: '''At the start of the Activation phase, you may remove 1 stress token from 1 other friendly ship at Range 1-2.'''
        'Bodhi Rook':
            text: '''When a friendly ship acquires a target lock, that ship can lock onto an enemy ship at Range 1-3 of any friendly ship.'''
        'Heff Tobber':
            text: '''After an enemy ship executes a maneuver that causes it to overlap your ship, you may perform a free action.'''
        '''"Duchess"''':
            text: '''While you have the "Adaptive Ailerons" Upgrade card equipped, you may choose to ignore its card ability.'''
        '''"Pure Sabacc"''':
            text: '''When attacking, if you have 1 or fewer Damage cards, roll 1 additional attack die.'''
        '''"Countdown"''':
            text: '''When defending, if you are not stressed, during the "Compare Results" step, you may suffer 1 damage to cancel all dice results.  If you do, receive 1 stress token.'''
        'Nien Nunb':
            text: '''When you receive a stress token, if there is an enemy ship inside your firing arc at Range 1, you may discard that stress token.'''
        '"Snap" Wexley':
            text: '''After you execute a 2-, 3-, or 4-speed maneuver, if you are not touching a ship, you may perform a free boost action.'''
        'Jess Pava':
            text: '''When attacking or defending, you may reroll 1 of your dice for each other friendly ship at Range 1.'''
        'Ahsoka Tano':
            text: '''At the start of the Combat phase, you may spend 1 focus token to choose a friendly ship at Range 1.  It may perform 1 free action.'''
        'Captain Rex':
            text: '''After you perform an attack, assign the "Suppressive Fire" Condition card to the defender.'''
        'Major Stridan':
            text: '''For the purpose of your actions and Upgrade cards, you may treat friendly ships at Range 2-3 as being at Range 1.'''
        'Lieutenant Dormitz':
            text: '''During setup, friendly ships may placed anywhere in the play area at Range 1-2 of you.'''
        'Constable Zuvio':
            text: '''When you reveal a reverse maneuver, you may drop a bomb using your front guides (including a bomb with the "<strong>Action:</strong>" header).'''
        'Sarco Plank':
            text: '''When defending, instead of using your agility value, you may roll a number of defense dice equal to the speed of the maneuver you executed this round.'''
        'Genesis Red':
            text: '''After you acquire a target lock, assign focus and evade tokens to your ship until you have the same number of each token as the locked ship.'''
        'Quinn Jast':
            text: '''At the start of the Combat phase, you may receive a weapons disabled token to flip one of your discarded %TORPEDO% or %MISSILE% Upgrade cards faceup.'''
        'Inaldra':
            text: '''When attacking or defending, you may spend 1 shield to reroll any number of your dice.'''
        'Sunny Bounder':
            text: '''Once per round, after you roll or reroll dice, if you have the same result on each of your dice, add 1 matching result.'''
        'Lieutenant Kestal':
            text: '''When attacking, you may spend 1 focus token to cancel all of the defender's blank and %FOCUS% results.'''
        '"Double Edge"':
            text: '''Once per round, after you perform a secondary weapon attack that does not hit, you may perform an attack with a different weapon.'''
        'Viktor Hel':
            text: '''After defending, if you did not roll exactly 2 defense dice, the attacker receives 1 stress token.'''
        'Lowhhrick':
            text: '''When another friendly ship at Range 1 is defending, you may spend 1 reinforce token. If you do, the defender adds 1 %EVADE% result.'''
        'Wullffwarro':
            text: '''When attacking, if you have no shields and at least 1 Damage card assigned to you, roll 1 additional attack die.'''
        'Captain Nym':
            text: '''You may ignore friendly bombs. When a friendly ship is defending, if the attacker measures range through a friendly bomb token, the defender may add 1 %EVADE% result.'''
        'Captain Nym (Rebel)':
            text: '''Once per round, you may prevent a friendly bomb from detonating.'''
        'Sol Sixxa':
            text: '''When dropping a bomb, you may use the (%TURNLEFT% 1) or (%TURNRIGHT% 1) template instead of the (%STRAIGHT% 1) template.'''
        'Dalan Oberos':
            text: '''If you are not stressed, when you reveal a turn, bank, or Segnor's Loop maneuver, you may instead treat it as a red Tallon Roll maneuver of the same direction (left or right) using the template of the original revealed maneuver.'''
        'Thweek':
            text: '''During setup, before the "Place Forces" step, you may choose 1 enemy ship and assign the "Shadowed" or "Mimicked" Condition card to it.'''
        'Captain Jostero':
            text: '''Once per round, after an enemy ship that is not defending against an attack suffers damage or critical damage, you may perform an attack against that ship.'''
        'Major Vynder':
            text: '''When defending, if you have a weapons disabled token, roll 1 additional defense die.'''
        'Torani Kulda':
            text: '''After you perform an attack, each enemy ship inside your bullseye firing arc at Range 1-3 must choose to suffer 1 damage or remove all of its focus and evade tokens.'''
        'Fenn Rau (Sheathipede)':
            text: '''When an enemy ship inside your firing arc at Range 1-3 becomes the active ship during the Combat phase, if you are not stressed, you may receive 1 stress token.  If you do, that ship cannot spend tokens to modify its dice when attacking this round.'''
        '"Crimson Leader"':
            text: '''When attacking, if the defender is inside your firing arc, you may spend 1 %HIT% or %CRIT% result to assign the "Rattled" Condition to the defender.'''
        'Kylo Ren (TIE Silencer)':
            text: '''The first time you are hit by an attack each round, deal the "I'll Show You the Dark Side" Condition card to the attacker.'''

    upgrade_translations =
        "Ion Cannon Turret":
            text: """<strong>Attack:</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%If this attack hits the target ship, the ship suffers 1 damage and receives 1 ion token.  Then cancel all dice results."""
        "Proton Torpedoes":
            text: """<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.%LINEBREAK%You may change 1 of your %FOCUS% results to a %CRIT% result."""
        "R2 Astromech":
            text: """You may treat all 1- and 2-speed maneuvers as green maneuvers."""
        "R2-D2":
            text: """After executing a green maneuver, you may recover 1 shield (up to your shield value)."""
        "R2-F2":
            text: """<strong>Action:</strong> Increase your agility value by 1 until the end of this game round."""
        "R5-D8":
            text: """<strong>Action:</strong> Roll 1 defense die.%LINEBREAK%On a %EVADE% or %FOCUS% result, discard 1 of your facedown Damage cards."""
        "R5-K6":
            text: """After spending your target lock, roll 1 defense die.%LINEBREAK%On a %EVADE% result, immediately acquire a target lock on that same ship.  You cannot spend this target lock during this attack."""
        "R5 Astromech":
            text: """During the End phase, you may choose 1 of your faceup Damage cards with the Ship trait and flip it facedown."""
        "Determination":
            text: """When you are dealt a faceup Damage card with the Pilot trait, discard it immediately without resolving its effect."""
        "Swarm Tactics":
            text: """At the start of the Combat phase, you may choose 1 friendly ship at Range 1.%LINEBREAK%Until the end of this phase, treat the chosen ship as if its pilot skill were equal to your pilot skill."""
        "Squad Leader":
            text: """<strong>Action:</strong> Choose 1 ship at Range 1-2 that has a lower pilot skill than you.%LINEBREAK%The chosen ship may immediately perform 1 free action."""
        "Expert Handling":
            text: """<strong>Action:</strong> Perform a free barrel roll action.  If you do not have the %BARRELROLL% action icon, receive 1 stress token.%LINEBREAK%You may then remove 1 enemy target lock from your ship."""
        "Marksmanship":
            text: """<strong>Action:</strong> When attacking this round, you may change 1 of your %FOCUS% results to a %CRIT% result and all of your other %FOCUS% results to %HIT% results."""
        "Concussion Missiles":
            text: """<strong>Attack (target lock):</strong>  Spend your target lock and discard this card to perform this attack.%LINEBREAK%You may change 1 of your blank results to a %HIT% result."""
        "Cluster Missiles":
            text: """<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack twice."""
        "Daredevil":
            text: """<strong>Action:</strong> Execute a white (%TURNLEFT% 1) or (%TURNRIGHT% 1) maneuver.  Then, receive 1 stress token.%LINEBREAK%Then, if you do not have the %BOOST% action icon, roll 2 attack dice.  Suffer any damage (%HIT%) and any critical damage (%CRIT%) rolled."""
        "Elusiveness":
            text: """When defending, you may receive 1 stress token to choose 1 attack die.  The attacker must reroll that die.%LINEBREAK%If you have at least 1 stress token, you cannot use this ability."""
        "Homing Missiles":
            text: """<strong>Attack (target lock):</strong> Discard this card to perform this attack.%LINEBREAK%The defender cannot spend evade tokens during this attack."""
        "Push the Limit":
            text: """Once per round, after you perform an action, you may perform 1 free action shown in your action bar.%LINEBREAK%Then receive 1 stress token."""
        "Deadeye":
            text: """%SMALLSHIPONLY%%LINEBREAK%You may treat the <strong>Attack (target lock):</strong> header as <strong>Attack (focus):</strong>.%LINEBREAK%When an attack instructs you to spend a target lock, you may spend a focus token instead."""
        "Expose":
            text: """<strong>Action:</strong> Until the end of the round, increase your primary weapon value by 1 and decrease your agility value by 1."""
        "Gunner":
            text: """After you perform an attack that does not hit, you may immediately perform a primary weapon attack.  You cannot perform another attack this round."""
        "Ion Cannon":
            text: """<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%If this attack hits, the defender suffers 1 damage and receives 1 ion token.  Then cancel all dice results."""
        "Heavy Laser Cannon":
            text: """<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%Immediately after rolling your attack dice, you must change all of your %CRIT% results to %HIT% results."""
        "Seismic Charges":
            text: """When you reveal your maneuver dial, you may discard this card to drop 1 seismic charge token.%LINEBREAK%This token detonates at the end of the Activation phase.%LINEBREAK%<strong>Seismic Charge Token:</strong> When this bomb token detonates, each ship at Range 1 of the token suffers 1 damage.  Then discard this token."""
        "Mercenary Copilot":
            text: """When attacking at Range 3, you may change 1 of your %HIT% results to a %CRIT% result."""
        "Assault Missiles":
            text: """<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.%LINEBREAK%If this attack hits, each other ship at Range 1 of the defender suffers 1 damage."""
        "Veteran Instincts":
            text: """Increase your pilot skill value by 2."""
        "Proximity Mines":
            text: """<strong>Action:</strong> Discard this card to <strong>drop</strong> 1 proximity mine token.%LINEBREAK%When a ship's base or maneuver template overlaps this token, this token <strong>detonates</strong>.%LINEBREAK%<strong>Proximity Mine Token:</strong> When this bomb token detonates, the ship that moved through or overlapped this token rolls 3 attack dice and suffers all damage (%HIT%) and critical damage (%CRIT%) rolled.  Then discard this token."""
        "Weapons Engineer":
            text: """You may maintain 2 target locks (only 1 per enemy ship).%LINEBREAK%When you acquire a target lock, you may lock onto 2 different ships."""
        "Draw Their Fire":
            text: """When a friendly ship at Range 1 is hit by an attack, you may suffer 1 of the uncanceled %CRIT% results instead of the target ship."""
        "Luke Skywalker":
            text: """%REBELONLY%%LINEBREAK%After you perform an attack that does not hit, you may immediately perform a primary weapon attack.  You may change 1 %FOCUS% result to a %HIT% result.  You cannot perform another attack this round."""
        "Nien Nunb":
            text: """%REBELONLY%%LINEBREAK%You may treat all %STRAIGHT% maneuvers as green maneuvers."""
        "Chewbacca":
            text: """%REBELONLY%%LINEBREAK%When you are dealt a Damage card, you may immediately discard that card and recover 1 shield.%LINEBREAK%Then, discard this Upgrade card."""
        "Advanced Proton Torpedoes":
            text: """<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.%LINEBREAK%You may change up to 3 of your blank results to %FOCUS% results."""
        "Autoblaster":
            text: """<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%Your %HIT% results cannot be canceled by defense dice.%LINEBREAK%The defender may cancel %CRIT% results before %HIT% results."""
        "Fire-Control System":
            text: """After you perform an attack, you may acquire a target lock on the defender."""
        "Blaster Turret":
            text: """<strong>Attack (focus):</strong> Spend 1 focus token to perform this attack against 1 ship (even a ship outside your firing arc)."""
        "Recon Specialist":
            text: """When you perform a focus action, assign 1 additional focus token to your ship."""
        "Saboteur":
            text: """<strong>Action:</strong> Choose 1 enemy ship at Range 1 and roll 1 attack die.  On a %HIT% or %CRIT% result, choose 1 random facedown Damage card assigned to that ship, flip it faceup, and resolve it."""
        "Intelligence Agent":
            text: """At the start of the Activation phase, choose 1 enemy ship at Range 1-2.  You may look at that ship's chosen maneuver."""
        "Proton Bombs":
            text: """When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 proton bomb token.%LINEBREAK%This token <strong>detonates</strong> at the end of the Activation phase.%LINEBREAK%<strong>Proton Bomb Token:</strong> When this bomb token detonates, deal 1 <strong>faceup</strong> Damage card to each ship at Range 1 of the token.  Then discard this token."""
        "Adrenaline Rush":
            text: """When you reveal a red maneuver, you may discard this card to treat that maneuver as a white maneuver until the end of the Activation phase."""
        "Advanced Sensors":
            text: """Immediately before you reveal your maneuver, you may perform 1 free action.%LINEBREAK%If you use this ability, you must skip your "Perform Action" step during this round."""
        "Sensor Jammer":
            text: """When defending, you may change 1 of the attacker's %HIT% results into a %FOCUS% result.%LINEBREAK%The attacker cannot reroll the die with the changed result."""
        "Darth Vader":
            text: """%IMPERIALONLY%%LINEBREAK%After you perform an attack against an enemy ship, you may suffer 2 damage to cause that ship to suffer 1 critical damage."""
        "Rebel Captive":
            text: """%IMPERIALONLY%%LINEBREAK%Once per round, the first ship that declares you as the target of an attack immediately receives 1 stress token."""
        "Flight Instructor":
            text: """When defending, you may reroll 1 of your %FOCUS% results.  If the attacker's pilot skill value is "2" or lower, you may reroll 1 of your blank results instead."""
        "Navigator":
            text: """When you reveal a maneuver, you may rotate your dial to another maneuver with the same bearing.%LINEBREAK%You cannot rotate to a red maneuver if you have any stress tokens."""
        "Opportunist":
            text: """When attacking, if the defender does not have any focus or evade tokens, you may receive 1 stress token to roll 1 additional attack die.%LINEBREAK%You cannot use this ability if you have any stress tokens."""
        "Comms Booster":
            text: """<strong>Energy:</strong> Spend 1 energy to remove all stress tokens from a friendly ship at Range 1-3.  Then assign 1 focus token to that ship."""
        "Slicer Tools":
            text: """<strong>Action:</strong> Choose 1 or more ships at Range 1-3 that have a stress token.  For each ship chosen, you may spend 1 energy to cause that ship to suffer 1 damage."""
        "Shield Projector":
            text: """When an enemy ship is declaring either a small or large ship as the target of its attack, you may spend 3 energy to force that ship to target you if possible."""
        "Ion Pulse Missiles":
            text: """<strong>Attack (target lock):</strong> Discard this card to perform this attack.%LINEBREAK%If this attack hits, the defender suffers 1 damage and receives 2 ion tokens.  Then cancel <strong>all</strong> dice results."""
        "Wingman":
            text: """At the start of the Combat phase, remove 1 stress token from another friendly ship at Range 1."""
        "Decoy":
            text: """At the start of the Combat phase, you may choose 1 friendly ship at Range 1-2.  Exchange your pilot skill with that ship's pilot skill until the end of the phase."""
        "Outmaneuver":
            text: """When attacking a ship inside your firing arc, if you are not inside that ship's firing arc, reduce its agility value by 1 (to a minimum of 0)."""
        "Predator":
            text: """When attacking, you may reroll 1 attack die.  If the defender's pilot skill value is "2" or lower, you may instead reroll up to 2 attack dice."""
        "Flechette Torpedoes":
            text: """<strong>Attack (target lock):</strong> Discard this card and spend your target lock to perform this attack.%LINEBREAK%After you perform this attack, the defender receives 1 stress token if its hull value is "4" or lower."""
        "R7 Astromech":
            text: """Once per round when defending, if you have a target lock on the attacker, you may spend the target lock to choose any or all attack dice.  The attacker must reroll the chosen dice."""
        "R7-T1":
            text: """<strong>Action:</strong> Choose an enemy ship at Range 1-2.  If you are inside that ship's firing arc, you may acquire a target lock on that ship.  Then, you may perform a free boost action."""
        "Tactician":
            text: """After you perform an attack against a ship inside your firing arc at Range 2, that ship receives 1 stress token."""
        "R2-D2 (Crew)":
            text: """%REBELONLY%%LINEBREAK%At the end of the End phase, if you have no shields, you may recover 1 shield and roll 1 attack die.  On a %HIT% result, randomly flip 1 of your facedown Damage cards faceup and resolve it."""
        "C-3PO":
            text: """%REBELONLY%%LINEBREAK%Once per round, before you roll 1 or more defense dice, you may guess aloud a number of %EVADE% results.  If you roll that many %EVADE% results (before modifying dice), add 1 %EVADE% result."""
        "Single Turbolasers":
            text: """<strong>Attack (Energy):</strong> Spend 2 energy from this card to perform this attack.  The defender doubles his agility value against this attack.  You may change 1 of your %FOCUS% results to a %HIT% result."""
        "Quad Laser Cannons":
            text: """<strong>Attack (Energy):</strong> Spend 1 energy from this card to perform this attack.  If this attack does not hit, you may immediately spend 1 energy from this card to perform this attack again."""
        "Tibanna Gas Supplies":
            text: """<strong>Energy:</strong> You may discard this card to gain 3 energy."""
        "Ionization Reactor":
            text: """<strong>Energy:</strong> Spend 5 energy from this card and discard this card to cause each other ship at Range 1 to suffer 1 damage and receive 1 ion token."""
        "Engine Booster":
            text: """Immediately before you reveal your maneuver dial, you may spend 1 energy to execute a white (%STRAIGHT% 1) maneuver.  You cannot use this ability if you would overlap another ship."""
        "R3-A2":
            text: """When you declare the target of your attack, if the defender is inside your firing arc, you may receive 1 stress token to cause the defender to receive 1 stress token."""
        "R2-D6":
            text: """Your upgrade bar gains the %ELITE% upgrade icon.%LINEBREAK%You cannot equip this upgrade if you already have a %ELITE% upgrade icon or if your pilot skill value is "2" or lower."""
        "Enhanced Scopes":
            text: """During the Activation phase, treat your pilot skill value as "0"."""
        "Chardaan Refit":
            text: """<span class="card-restriction">A-Wing only.</span>%LINEBREAK%This card has a negative squad point cost."""
        "Proton Rockets":
            text: """<strong>Attack (Focus):</strong> Discard this card to perform this attack.%LINEBREAK%You may roll additional attack dice equal to your agility value, to a maximum of 3 additional dice."""
        "Kyle Katarn":
            text: """%REBELONLY%%LINEBREAK%After you remove a stress token from your ship, you may assign a focus token to your ship."""
        "Jan Ors":
            text: """%REBELONLY%%LINEBREAK%Once per round, when a friendly ship at Range 1-3 performs a focus action or would be assigned a focus token, you may assign it an evade token instead."""
        "Toryn Farr":
            text: """%HUGESHIPONLY% %REBELONLY%%LINEBREAK%<strong>Action:</strong> Spend any amount of energy to choose that many enemy ships at Range 1-2.  Remove all focus, evade, and blue target lock tokens from those ships."""
        "R4-D6":
            text: """When you are hit by an attack and there are at least 3 uncanceled %HIT% results, you may choose to cancel those results until there are 2 remaining.  For each result canceled this way, receive 1 stress token."""
        "R5-P9":
            text: """At the end of the Combat phase, you may spend 1 of your focus tokens to recover 1 shield (up to your shield value)."""
        "WED-15 Repair Droid":
            text: """%HUGESHIPONLY%%LINEBREAK%<strong>Action:</strong> Spend 1 energy to discard 1 of your facedown Damage cards, or spend 3 energy to discard 1 of your faceup Damage cards."""
        "Carlist Rieekan":
            text: """%HUGESHIPONLY% %REBELONLY%%LINEBREAK%At the start of the Activation phase, you may discard this card to treat each friendly ship's pilot skill value as "12" until the end of the phase."""
        "Jan Dodonna":
            text: """%HUGESHIPONLY% %REBELONLY%%LINEBREAK%When another friendly ship at Range 1 is attacking, it may change 1 of its %HIT% results to a %CRIT%."""
        "Expanded Cargo Hold":
            text: """<span class="card-restriction">GR-75 only.</span>%LINEBREAK%Once per round, when you would be dealt a faceup Damage card, you may draw that card from either the fore or aft Damage deck."""
        "Backup Shield Generator":
            text: """At the end of each round, you may spend 1 energy to recover 1 shield (up to your shield value)."""
        "EM Emitter":
            text: """When you obstruct an attack, the defender rolls 3 additional defense dice (instead of 1)."""
        "Frequency Jammer":
            text: """When you perform a jam action, choose 1 enemy ship that does not have a stress token and is at Range 1 of the jammed ship.  The chosen ship receives 1 stress token."""
        "Han Solo":
            text: """%REBELONLY%%LINEBREAK%When attacking, if you have a target lock on the defender, you may spend that target lock to change all of your %FOCUS% results to %HIT% results."""
        "Leia Organa":
            text: """%REBELONLY%%LINEBREAK%At the start of the Activation phase, you may discard this card to allow all friendly ships that reveal a red maneuver to treat that maneuver as a white maneuver until the end of the phase."""
        "Targeting Coordinator":
            text: """<strong>Energy:</strong> You may spend 1 energy to choose 1 friendly ship at Range 1-2.  Acquire a target lock, then assign the blue target lock token to the chosen ship."""
        "Raymus Antilles":
            text: """%HUGESHIPONLY% %REBELONLY%%LINEBREAK%At the start of the Activation phase, choose 1 enemy ship at Range 1-3.  You may look at that ship's chosen maneuver.  If the maneuver is white, assign that ship 1 stress token."""
        "Gunnery Team":
            text: """Once per round, when attacking with a secondary weapon, you may spend 1 energy to change 1 of your blank results to a %HIT% result."""
        "Sensor Team":
            text: """When acquiring a target lock, you may lock onto an enemy ship at Range 1-5 instead of 1-3."""
        "Engineering Team":
            text: """During the Activation phase, when you reveal a %STRAIGHT% maneuver, gain 1 additional energy during the "Gain Energy" step."""
        "Lando Calrissian":
            text: """%REBELONLY%%LINEBREAK%<strong>Action:</strong> Roll 2 defense dice.  For each %FOCUS% result, assign 1 focus token to your ship.  For each %EVADE% result, assign 1 evade token to your ship."""
        "Mara Jade":
            text: """%IMPERIALONLY%%LINEBREAK%At the end of the Combat phase, each enemy ship at Range 1 that does not have a stress token receives 1 stress token."""
        "Fleet Officer":
            text: """%IMPERIALONLY%%LINEBREAK%<strong>Action:</strong> Choose up to 2 friendly ships at Range 1-2 and assign 1 focus token to each of those ships.  Then receive 1 stress token."""
        "Lone Wolf":
            text: """When attacking or defending, if there are no other friendly ships at Range 1-2, you may reroll 1 of your blank results."""
        "Stay On Target":
            text: """When you reveal a maneuver, you may rotate your dial to another maneuver with the same speed.%LINEBREAK%Treat that maneuver as a red maneuver."""
        "Dash Rendar":
            text: """%REBELONLY%%LINEBREAK%You may perform attacks while overlapping an obstacle.%LINEBREAK%Your attacks cannot be obstructed."""
        '"Leebo"':
            text: """%REBELONLY%%LINEBREAK%<strong>Action:</strong> Perform a free boost action.  Then receive 1 ion token."""
        "Ruthlessness":
            text: """%IMPERIALONLY%%LINEBREAK%After you perform an attack that hits, you <strong>must</strong> choose 1 other ship at Range 1 of the defender (other than yourself).  That ship suffers 1 damage."""
        "Intimidation":
            text: """While you are touching an enemy ship, reduce that ship's agility value by 1."""
        "Ysanne Isard":
            text: """%IMPERIALONLY%%LINEBREAK%At the start of the Combat phase, if you have no shields and at least 1 Damage card assigned to your ship, you may perform a free evade action."""
        "Moff Jerjerrod":
            text: """%IMPERIALONLY%%LINEBREAK%When you are dealt a faceup Damage card, you may discard this Upgrade card or another %CREW% Upgrade card to flip that Damage card facedown (without resolving its effect)."""
        "Ion Torpedoes":
            text: """<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.%LINEBREAK%If this attack hits, the defender and each ship at Range 1 of it receives 1 ion token."""
        "Bodyguard":
            text: """%SCUMONLY%%LINEBREAK%At the start of the Combat phase, you may spend a focus token to choose a friendly ship at Range 1 with higher pilot skill than you. Increase its agility value by 1 until the end of the round."""
        "Calculation":
            text: """When attacking, you may spend a focus token to change 1 of your %FOCUS% results to a %CRIT% result."""
        "Accuracy Corrector":
            text: """When attacking, during the "Modify Attack Dice" step, you may cancel all of your dice results. Then, you may add 2 %HIT% results to your roll.%LINEBREAK%Your dice cannot be modified again during this attack."""
        "Inertial Dampeners":
            text: """When you reveal your maneuver, you may discard this card to instead perform a white (0 %STOP%) maneuver. Then receive 1 stress token."""
        "Flechette Cannon":
            text: """<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%If this attack hits, the defender suffers 1 damage and, if the defender is not stressed, it also receives 1 stress token.  Then cancel <strong>all</strong> dice results."""
        '"Mangler" Cannon':
            text: """<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%When attacking, you may change 1 of your %HIT% results to a %CRIT% result."""
        "Dead Man's Switch":
            text: """When you are destroyed, each ship at Range 1 suffers 1 damage."""
        "Feedback Array":
            text: """During the Combat phase, instead of performing any attacks, you may receive 1 ion token and suffer 1 damage to choose 1 enemy ship at Range 1.  That ship suffers 1 damage."""
        '"Hot Shot" Blaster':
            text: """<strong>Attack:</strong> Discard this card to attack 1 ship (even a ship outside your firing arc)."""
        "Greedo":
            text: """%SCUMONLY%%LINEBREAK%The first time you attack each round and the first time you defend each round, the first Damage card dealt is dealt faceup."""
        "Salvaged Astromech":
            text: """When you are dealt a faceup Damage card with the <strong>Ship</strong> trait, you may immediately discard that card (before resolving its effect).%LINEBREAK%Then, discard this Upgrade card."""
        "Bomb Loadout":
            text: """<span class="card-restriction">Y-Wing only.</span>%LINEBREAK%Your upgrade bar gains the %BOMB% icon."""
        '"Genius"':
            text: """If you are equipped with a bomb that can be dropped when you reveal your maneuver, you may drop the bomb <strong>after</strong> you execute your maneuver instead."""
        "Unhinged Astromech":
            text: """You may treat all 3-speed maneuvers as green maneuvers."""
        "R4-B11":
            text: """When attacking, if you have a target lock on the defender, you may spend the target lock to choose any or all defense dice. The defender must reroll the chosen dice."""
        "Autoblaster Turret":
            text: """<strong>Attack:</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%Your %HIT% results cannot be canceled by defense dice. The defender may cancel %CRIT% results before %HIT% results."""
        "R4 Agromech":
            text: """When attacking, after you spend a focus token, you may acquire a target lock on the defender."""
        "K4 Security Droid":
            text: """%SCUMONLY%%LINEBREAK%After executing a green maneuver, you may acquire a target lock."""
        "Outlaw Tech":
            text: """%SCUMONLY%%LINEBREAK%After you execute a red maneuver, you may assign 1 focus token to your ship."""
        "Advanced Targeting Computer":
            text: """<span class="card-restriction">TIE Advanced only.</span>%LINEBREAK%When attacking with your primary weapon, if you have a target lock on the defender, you may add 1 %CRIT% result to your roll.  If you do, you cannot spend target locks during this attack."""
        "Ion Cannon Battery":
            text: """<strong>Attack (energy):</strong> Spend 2 energy from this card to perform this attack.  If this attack hits, the defender suffers 1 critical damage and receives 1 ion token.  Then cancel <strong>all</strong> dice results."""
        "Extra Munitions":
            text: """When you equip this card, place 1 ordnance token on each equipped %TORPEDO%, %MISSILE%, and %BOMB% Upgrade card.  When you are instructed to discard an Upgrade card, you may discard 1 ordnance token on that card instead."""
        "Cluster Mines":
            text: """<strong>Action:</strong> Discard this card to <strong>drop</strong> 3 cluster mine tokens.<br /><br />When a ship's base or maneuver template overlaps a cluster mine token, that token <strong>detonates</strong>.<br /><br /><strong>Cluster Mines Tokens:</strong> When one of these bomb tokens detonates, the ship that moved through or overlapped this token rolls 2 attack dice and suffers 1 damage for each %HIT% and %CRIT% rolled.  Then discard that token."""
        "Glitterstim":
            text: """At the start of the Combat phase, you may discard this card and receive 1 stress token.  If you do, until the end of the round, when attacking  or defending, you may change all of your %FOCUS% results to %HIT% or %EVADE% results."""
        "Grand Moff Tarkin":
            text: """%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%At the start of the Combat phase, you may choose another ship at Range 1-4.  Either remove 1 focus token from the chosen ship or assign 1 focus token to that ship."""
        "Captain Needa":
            text: """%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%If you overlap an obstacle during the Activation phase, do not suffer 1 faceup damage card.  Instead, roll 1 attack die.  On a %HIT% or %CRIT% result, suffer 1 damage."""
        "Admiral Ozzel":
            text: """%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%<strong>Energy:</strong> You may remove up to 3 shields from your ship.  For each shield removed, gain 1 energy."""
        "Emperor Palpatine":
            text: """%IMPERIALONLY%%LINEBREAK%Once per round, before a friendly ship rolls dice, you may name a die result. After rolling, you must change 1 of your dice results to the named result. That die result cannot be modified again."""
        "Bossk":
            text: """%SCUMONLY%%LINEBREAK%After you perform an attack that does not hit, if you are not stressed, you <strong>must</strong> receive 1 stress token. Then assign 1 focus token to your ship and acquire a target lock on the defender."""
        "Lightning Reflexes":
            text: """%SMALLSHIPONLY%%LINEBREAK%After you execute a white or green maneuver on your dial, you may discard this card to rotate your ship 180&deg;.  Then receive 1 stress token <strong>after</strong> the "Check Pilot Stress" step."""
        "Twin Laser Turret":
            text: """<strong>Attack:</strong> Perform this attack <strong>twice</strong> (even against a ship outside your firing arc).<br /><br />Each time this attack hits, the defender suffers 1 damage.  Then cancel <strong>all</strong> dice results."""
        "Plasma Torpedoes":
            text: """<strong>Attack (target lock):</strong> Spend your target lock and discard this card to perform this attack.<br /><br />If this attack hits, after dealing damage, remove 1 shield token from the defender."""
        "Ion Bombs":
            text: """When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 ion bomb token.<br /><br />This token <strong>detonates</strong> at the end of the Activation phase.<br /><br /><strong>Ion Bombs Token:</strong> When this bomb token detonates, each ship at Range 1 of the token receives 2 ion tokens.  Then discard this token."""
        "Conner Net":
            text: """<strong>Action:</strong> Discard this card to <strong>drop</strong> 1 Conner Net token.<br /><br />When a ship's base or maneuver template overlaps this token, this token <strong>detonates</strong>.<br /><br /><strong>Conner Net Token:</strong> When this bomb token detonates, the ship that moved through or overlapped this token suffers 1 damage, receives 2 ion tokens, and skips its "Perform Action" step.  Then discard this token."""
        "Bombardier":
            text: """When dropping a bomb, you may use the (%STRAIGHT% 2) template instead of the (%STRAIGHT% 1) template."""
        'Crack Shot':
            text: '''When attacking a ship inside your firing arc, at the start of the "Compare Results" step, you may discard this card to cancel 1 of the defender's %EVADE% results.'''
        "Advanced Homing Missiles":
            text: """<strong>Attack (target lock):</strong> Discard this card to perform this attack.%LINEBREAK%If this attack hits, deal 1 faceup Damage card to the defender.  Then cancel <strong>all</strong> dice results."""
        'Agent Kallus':
            text: '''%IMPERIALONLY%%LINEBREAK%At the start of the first round, choose 1 enemy small or large ship.  When attacking or defending against that ship, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result.'''
        'XX-23 S-Thread Tracers':
            text: """<strong>Attack (focus):</strong> Discard this card to perform this attack.  If this attack hits, each friendly ship at Range 1-2 of you may acquire a target lock on the defender.  Then cancel <strong>all</strong> dice results."""
        "Tractor Beam":
            text: """<strong>Attack:</strong> Attack 1 ship.%LINEBREAK%If this attack hits, the defender receives 1 tractor beam token.  Then cancel <strong>all</strong> dice results."""
        "Cloaking Device":
            text: """%SMALLSHIPONLY%%LINEBREAK%<strong>Action:</strong> Perform a free cloak action.%LINEBREAK%At the end of each round, if you are cloaked, roll 1 attack die.  On a %FOCUS% result, discard this card, then decloak or discard your cloak token."""
        "Shield Technician":
            text: """%HUGESHIPONLY%%LINEBREAK%When you perform a recover action, instead of spending all of your energy, you can choose any amount of energy to spend."""
        "Weapons Guidance":
            text: """When attacking, you may spend a focus token to change 1 of your blank results to a %HIT% result."""
        "BB-8":
            text: """When you reveal a green maneuver, you may perform a free barrel roll action."""
        "R5-X3":
            text: """Before you reveal your maneuver, you may discard this card to ignore obstacles until the end of the round."""
        "Wired":
            text: """When attacking or defending, if you are stressed, you may reroll 1 or more of your %FOCUS% results."""
        'Cool Hand':
            text: '''When you receive a stress token, you may discard this card to assign 1 focus or evade token to your ship.'''
        'Juke':
            text: '''%SMALLSHIPONLY%%LINEBREAK%When attacking, if you have an evade token, you may change 1 of the defender's %EVADE% results into a %FOCUS% result.'''
        'Comm Relay':
            text: '''You cannot have more than 1 evade token.%LINEBREAK%During the End phase, do not remove an unused evade token from your ship.'''
        'Dual Laser Turret':
            text: '''%GOZANTIONLY%%LINEBREAK%<strong>Attack (energy):</strong> Spend 1 energy from this card to perform this attack against 1 ship (even a ship outside your firing arc).'''
        'Broadcast Array':
            text: '''%GOZANTIONLY%%LINEBREAK%Your action bar gains the %JAM% action icon.'''
        'Rear Admiral Chiraneau':
            text: '''%HUGESHIPONLY% %IMPERIALONLY%%LINEBREAK%<strong>Action:</strong> Execute a white (%STRAIGHT% 1) maneuver.'''
        'Ordnance Experts':
            text: '''Once per round, when a friendly ship at Range 1-3 performs an attack with a %TORPEDO% or %MISSILE% secondary weapon, it may change 1 of its blank results to a %HIT% result.'''
        'Docking Clamps':
            text: '''%GOZANTIONLY% %LIMITED%%LINEBREAK%You may attach up to 4 TIE fighters, TIE interceptors, TIE bombers, or TIE Advanced to this ship.  All attached ships must have the same ship type.'''
        '"Zeb" Orrelios':
            text: """%REBELONLY%%LINEBREAK%Enemy ships inside your firing arc that you are touching are not considered to be touching you when either you or they activate during the Combat phase."""
        'Kanan Jarrus':
            text: """%REBELONLY%%LINEBREAK%Once per round, after a friendly ship at Range 1-2 executes a white maneuver, you may remove 1 stress token from that ship."""
        'Reinforced Deflectors':
            text: """%LARGESHIPONLY%%LINEBREAK%After defending, if you suffered a combination of 3 or more damage and critical damage during the attack, recover 1 shield (up to your shield value)."""
        'Dorsal Turret':
            text: """<strong>Attack:</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%If the target of this attack is at Range 1, roll 1 additional attack die."""
        'Targeting Astromech':
            text: '''After you execute a red maneuver, you may acquire a target lock.'''
        'Hera Syndulla':
            text: """%REBELONLY%%LINEBREAK%You may reveal and execute red maneuvers even while you are stressed."""
        'Ezra Bridger':
            text: """%REBELONLY%%LINEBREAK%When attacking, if you are stressed, you may change 1 of your %FOCUS% results to a %CRIT% result."""
        'Sabine Wren':
            text: """%REBELONLY%%LINEBREAK%Your upgrade bar gains the %BOMB% upgrade icon.  Once per round, before a friendly bomb token is removed, choose 1 enemy ship at Range 1 of that token. That ship suffers 1 damage."""
        '"Chopper"':
            text: """%REBELONLY%%LINEBREAK%You may perform actions even while you are stressed.%LINEBREAK%After you perform an action while you are stressed, suffer 1 damage."""
        'Construction Droid':
            text: '''%HUGESHIPONLY% %LIMITED%%LINEBREAK%When you perform a recover action, you may spend 1 energy to discard 1 facedown Damage card.'''
        'Cluster Bombs':
            text: '''After defending, you may discard this card.  If you do, each other ship at Range 1 of the defending section rolls 2 attack dice, suffering all damage (%HIT%) and critical damage (%CRIT%) rolled.'''
        "Adaptability":
            text: """<span class="card-restriction">Dual card.</span>%LINEBREAK%<strong>Side A:</strong> Increase your pilot skill value by 1.%LINEBREAK%<strong>Side B:</strong> Decrease your pilot skill value by 1."""
        "Electronic Baffle":
            text: """When you receive a stress token or an ion token, you may suffer 1 damage to discard that token."""
        "4-LOM":
            text: """%SCUMONLY%%LINEBREAK%When attacking, during the "Modify Attack Dice" step, you may receive 1 ion token to choose 1 of the defender's focus or evade tokens.  That token cannot be spent during this attack."""
        "Zuckuss":
            text: """%SCUMONLY%%LINEBREAK%When attacking, if you are not stressed, you may receive any number of stress tokens to choose an equal number of defense dice.  The defender must reroll those dice."""
        'Rage':
            text: """<strong>Action:</strong> Assign 1 focus token to your ship and receive 2 stress tokens.  Until the end of the round, when attacking, you may reroll up to 3 attack dice."""
        "Attanni Mindlink":
            text: """%SCUMONLY%%LINEBREAK%Each time you are assigned a focus or stress token, each other friendly ship with Attanni Mindlink must also be assigned the same type of token if it does not already have one."""
        "Boba Fett":
            text: """%SCUMONLY%%LINEBREAK%After performing an attack, if the defender was dealt a faceup Damage card, you may discard this card to choose and discard 1 of the defender's Upgrade cards."""
        "Dengar":
            text: """%SCUMONLY%%LINEBREAK%When attacking, you may reroll 1 attack die.  If the defender is a unique pilot, you may instead reroll up to 2 attack dice."""
        '"Gonk"':
            text: """%SCUMONLY%%LINEBREAK%<strong>Action:</strong> Place 1 shield token on this card.%LINEBREAK%<strong>Action:</strong> Remove 1 shield token from this card to recover 1 shield (up to your shield value)."""
        "R5-P8":
            text: """Once per round, after defending, you may roll 1 attack die.  On a %HIT% result, the attacker suffers 1 damage.  On a %CRIT% result, you and the attacker each suffer 1 damage."""
        'Thermal Detonators':
            text: """When you reveal your maneuver dial, you may discard this card to <strong>drop</strong> 1 thermal detonator token.%LINEBREAK%This token <strong>detonates</strong> at the end of the Activation phase.%LINEBREAK%<strong>Thermal Detonator Token:</strong> When this bomb token detonates, each ship at Range 1 of the token suffers 1 damage and receives 1 stress token.  Then discard this token."""
        "Overclocked R4":
            text: """During the Combat phase, when you spend a focus token, you may receive 1 stress token to assign 1 focus token to your ship."""
        'Systems Officer':
            text: '''%IMPERIALONLY%%LINEBREAK%After you execute a green maneuver, choose another friendly ship at Range 1.  That ship may acquire a target lock.'''
        'Tail Gunner':
            text: '''When attacking from your rear-facing auxiliary firing arc, reduce the defender's agility by 1 (to a minimum of "0").'''
        'R3 Astromech':
            text: '''Once per round, when attacking with a primary weapon, you may cancel 1 of your %FOCUS% results during the "Modify Attack Dice" step to assign 1 evade token to your ship.'''
        'Collision Detector':
            text: '''When performing a boost, barrel roll, or decloak, your ship and maneuver template can overlap obstacles.%LINEBREAK%When rolling for obstacle damage, ignore all %CRIT% results.'''
        'Sensor Cluster':
            text: '''When defending, you may spend a focus token to change 1 of your blank results to an %EVADE% result.'''
        'Fearlessness':
            text: '''%SCUMONLY%%LINEBREAK%When attacking, if you are inside the defender's firing arc at Range 1 and the defender is inside your firing arc, you may add 1 %HIT% result to your roll.'''
        'Ketsu Onyo':
            text: '''%SCUMONLY%%LINEBREAK%At the start of the End phase, you may choose 1 ship in your firing arc at Range 1-2.  That ship does not remove its tractor beam tokens.'''
        'Latts Razzi':
            text: '''%SCUMONLY%%LINEBREAK%When defending, you may remove 1 stress token from the attacker to add 1 %EVADE% result to your roll.'''
        'IG-88D':
            text: '''%SCUMONLY%%LINEBREAK%You have the pilot ability of each other friendly ship with the <em>IG-2000</em> Upgrade card (in addition to your own pilot ability).'''
        'Rigged Cargo Chute':
            text: '''%LARGESHIPONLY%%LINEBREAK%<strong>Action:</strong> Discard this card to <strong>drop</strong> one cargo token.'''
        'Seismic Torpedo':
            text: '''<strong>Action:</strong> Discard this card to choose an obstacle at Range 1-2 and inside your primary firing arc.  Each ship at Range 1 of the obstacle rolls 1 attack die and suffers any damage (%HIT%) or critical damage (%CRIT%) rolled.  Then remove the obstacle.'''
        'Black Market Slicer Tools':
            text: '''<strong>Action:</strong> Choose a stressed enemy ship at Range 1-2 and roll 1 attack die. On a (%HIT%) or (%CRIT%) result, remove 1 stress token and deal it 1 facedown Damage card.'''
        # Wave X
        'Kylo Ren':
            text: '''%IMPERIALONLY%%LINEBREAK%<strong>Action:</strong> Assign the "I'll Show You the Dark Side" Condition card to an enemy ship at Range 1-3.'''
        'Unkar Plutt':
            text: '''%SCUMONLY%%LINEBREAK%After executing a maneuver that causes you to overlap an enemy ship, you may suffer 1 damage to perform 1 free action.'''
        'A Score to Settle':
            text: '''During setup, before the "Place Forces" step, choose 1 enemy ship and deal the "A Debt to Pay" Condition card to it.%LINEBREAK%When attacking a ship that has the "A Debt to Pay" Condition card, you may change 1 %FOCUS% result to a %CRIT% result.'''
        'Jyn Erso':
            text: '''%REBELONLY%%LINEBREAK%<strong>Action:</strong> Choose 1 friendly ship at Range 1-2. Assign 1 focus token to that ship for each enemy ship inside your firing arc at Range 1-3.  You cannot assign more than 3 focus tokens in this way.'''
        'Cassian Andor':
            text: '''%REBELONLY%%LINEBREAK%At the end of the Planning phase, you may choose an enemy ship at Range 1-2.  Guess aloud that ship's bearing and speed, then look at its dial.  If you are correct, you may rotate your dial to another maneuver.'''
        'Finn':
            text: '''%REBELONLY%%LINEBREAK%When attacking with a primary weapon or defending, if the enemy ship is inside your firing arc, you may add 1 blank result to your roll.'''
        'Rey':
            text: '''%REBELONLY%%LINEBREAK%At the start of the End phase, you may place 1 of your ship's focus tokens on this card.  At the start of the Combat phase, you may assign 1 of those tokens to your ship.'''
        'Burnout SLAM':
            text: '''%LARGESHIPONLY%%LINEBREAK%Your action bar gains the %SLAM% action icon.%LINEBREAK%After you perform a SLAM action, discard this card.'''
        'Primed Thrusters':
            text: '''%SMALLSHIPONLY%%LINEBREAK%Stress tokens do not prevent you from performing boost or barrel roll actions unless you have 3 or more stress tokens.'''
        'Pattern Analyzer':
            text: '''When executing a maneuver, you may resolve the "Check Pilot Stress" step after the "Perform Action" step (instead of before that step).'''
        'Snap Shot':
            text: '''After an enemy ship executes a maneuver, you may perform this attack against that ship.  <strong>Attack:</strong> Attack 1 ship.  You cannot modify your attack dice and cannot attack again this phase.'''
        'M9-G8':
            text: '''%REBELONLY%%LINEBREAK%When a ship you have locked is attacking, you may choose 1 attack die.  The attacker must reroll that die.%LINEBREAK%You can acquire target locks on other friendly ships.'''
        'EMP Device':
            text: '''During the Combat phase, instead of performing any attacks, you may discard this card to assign 2 ion tokens to each ship at Range 1.'''
        'Captain Rex':
            text: '''%REBELONLY%%LINEBREAK%After you perform an attack that does not hit, you may assign 1 focus token to your ship.'''
        'General Hux':
            text: '''%IMPERIALONLY%%LINEBREAK%<strong>Action:</strong> Choose up to 3 friendly ships at Range 1-2.  Assign 1 focus token to each and assign the "Fanatical Devotion" Condition card to 1 of them.  Then receive 1 stress token.'''
        'Operations Specialist':
            text: '''%LIMITED%%LINEBREAK%After a friendly ship at Range 1-2 performs an attack that does not hit, you may assign 1 focus token to a friendly ship at Range 1-3 of the attacker.'''
        'Targeting Synchronizer':
            text: '''When a friendly ship at Range 1-2 is attacking a ship you have locked, the friendly ship treats the "<strong>Attack (target lock):</strong> header as "<strong>Attack:</strong>."  If a game effect instructs that ship to spend a target lock, it may spend your target lock instead.'''
        'Hyperwave Comm Scanner':
            text: '''At the start of the "Place Forces" step, you may choose to treat your pilot skill value as "0," "6," or "12" until the end of the step.%LINEBREAK%During setup, after another friendly ship is placed at Range 1-2, you may assign 1 focus or evade token to it.'''
        'Trick Shot':
            text: '''When attacking, if the attack is obstructed, you may roll 1 additional attack die.'''
        'Hotshot Co-pilot':
            text: '''When attacking with a primary weapon, the defender must spend 1 focus token if able.%LINEBREAK%When defending, the attacker must spend 1 focus token if able.'''
        '''Scavenger Crane''':
            text: '''After a ship at Range 1-2 is destroyed, you may choose a discarded %TORPEDO%, %MISSILE%, %BOMB%, %CANNON%, %TURRET%, or Modification Upgrade card that was equipped to your ship and flip it faceup.  Then roll 1 attack die.  On a blank result, discard Scavenger Crane.'''
        'Bodhi Rook':
            text: '''%REBELONLY%%LINEBREAK%When you acquire a target lock, you can lock onto an enemy ship at Range 1-3 of any friendly ship.'''
        'Baze Malbus':
            text: '''%REBELONLY%%LINEBREAK%After you perform an attack that does not hit, you may immediately perform a primary weapon attack against a different ship.  You cannot perform another attack this round.'''
        'Inspiring Recruit':
            text: '''Once per round, when a friendly ship at Range 1-2 removes a stress token, it may remove 1 additional stress token.'''
        'Swarm Leader':
            text: '''When performing a primary weapon attack, choose up to 2 other friendly ships that have the defender inside their firing arcs at Range 1-3. Remove 1 evade token from each chosen ship to roll 1 additional attack die for each token removed.'''
        'Bistan':
            text: '''%REBELONLY%%LINEBREAK%When attacking Range 1-2, you may change 1 of your %HIT% results to a %CRIT% result.'''
        'Expertise':
            text: '''When attacking, if you are not stressed, you may change all of your %FOCUS% results to %HIT% results.'''
        'BoShek':
            text: '''When a ship you are touching activates, you may look at its chosen maneuver.  If you do, its owner <strong>must</strong> rotate the dial to an adjacent maneuver.  The ship can reveal and execute that maneuver even while stressed.'''
        # C-ROC
        'Heavy Laser Turret':
            text: '''<span class="card-restriction">C-ROC Cruiser only.</span>%LINEBREAK%<strong>Attack (energy):</strong> Spend 2 energy from this card to perform this attack against 1 ship (even a ship outside of your firing arc).'''
        'Cikatro Vizago':
            text: '''%SCUMONLY%%LINEBREAK%At the start of the End phase, you may discard this card to replace a faceup %ILLICIT% or %CARGO% Upgrade card you have equipped with another Upgrade card of the same type of equal or fewer squad points.'''
        'Azmorigan':
            text: '''%HUGESHIPONLY% %SCUMONLY%%LINEBREAK%At the start of the End phase, you may spend 1 energy to replace a faceup %CREW% or %TEAM% Upgrade card you have equipped with another Upgrade card of the same type of equal or fewer squad points.'''
        'Quick-release Cargo Locks':
            text: '''<span class="card-restriction">C-ROC Cruiser and GR-75 Medium Transport only.</span>%LINEBREAK%At the end of the Activation phase, you may discard this card to <strong>place</strong> 1 container token.'''
        'Supercharged Power Cells':
            text: '''When attacking, you may discard this card to roll 2 additional attack dice.'''
        'ARC Caster':
            text: '''<span class="card-restriction">Rebel and Scum only.</span>%DUALCARD%%LINEBREAK%<strong>Side A:</strong>%LINEBREAK%<strong>Attack:</strong> Attack 1 ship.  If this attack hits, you must choose 1 other ship at Range 1 of the defender to suffer 1 damage.%LINEBREAK%Then flip this card.%LINEBREAK%<strong>Side B:</strong>%LINEBREAK%(Recharging) At the start of the Combat phase, you may receive a weapons disabled token to flip this card.'''
        'Wookiee Commandos':
            text: '''When attacking, you may reroll your %FOCUS% results.'''
        'Synced Turret':
            text: '''<strong>Attack (Target Lock):</strong> Attack 1 ship (even a ship outside your firing arc).%LINEBREAK%If the defender is inside your primary firing arc, you may reroll a number of attack dice up to your primary weapon value.'''
        'Unguided Rockets':
            text: '''<strong>Attack (focus):</strong> Attack 1 Ship.%LINEBREAK%Your attack dice can be modified only by spending a focus token for its standard effect.'''
        'Intensity':
            text: '''%SMALLSHIPONLY% %DUALCARD%%LINEBREAK%<strong>Side A:</strong> After you perform a boost or barrel roll action, you may assign 1 focus or evade token to your ship. If you do, flip this card.%LINEBREAK%<strong>Side B:</strong> (Exhausted) At the end of the Combat phase, you may spend 1 focus or evade token to flip this card.'''
        'Jabba the Hutt':
            text: '''%SCUMONLY%%LINEBREAK%When you equip this card, place 1 illicit token on each %ILLICIT% Upgrade card in your squad.  When you are instructed to discard an Upgrade card, you may discard 1 illicit token on that card instead.'''
        'IG-RM Thug Droids':
            text: '''When attacking, you may change 1 of your %HIT% results to a %CRIT% result.'''
        'Selflessness':
            text: '''%SMALLSHIPONLY% %REBELONLY%%LINEBREAK%When a friendly ship at Range 1 is hit by an attack, you may discard this card to suffer all uncanceled %HIT% results instead of the target ship.'''
        'Breach Specialist':
            text: '''When you are dealt a faceup Damage card, you may spend 1 reinforce token to flip it facedown (without resolving its effect).  If you do, until the end of the round, when you are dealt a faceup Damage card, flip it facedown (without resolving its effect).'''
        'Bomblet Generator':
            text: '''When you reveal your maneuver, you may drop 1 Bomblet token.%LINEBREAK%This token <strong>detonates</strong> at the end of the Activation phase.%LINEBREAK%<strong>Bomblet Token:</strong> When this token detonates, each ship at Range 1 rolls 2 attack dice and suffers all damage (%HIT%) and critical damage (%CRIT%) rolled. Then discard this token.'''
        'Cad Bane':
            text: '''%SCUMONLY%%LINEBREAK%Your upgrade bar gains the %BOMB% icon. Once per round, when an enemy ship rolls attack dice due to a friendly bomb detonating, you may choose any number of %FOCUS% and blank results.  It must reroll those results.'''
        'Minefield Mapper':
            text: '''During Setup, after the "Place Forces" step, you may discard any number of your equipped %BOMB% Upgrade cards.  Place all corresponding bomb tokens in the play area beyond Range 3 of enemy ships.'''
        'R4-E1':
            text: '''You can perform actions on your %TORPEDO% and %BOMB% Upgrade cards even if you are stressed. After you perform an action in this way, you may discard this card to remove 1 stress token from your ship.'''
        'Cruise Missiles':
            text: '''<strong>Attack (Target Lock):</strong> Discard this card to perform this attack.%LINEBREAK%You may roll additional attack dice equal to the speed of the manuever you performed this round, to a maximum of 4 additional dice.'''      
        'Ion Dischargers':
            text: '''After you receive an ion token, you may choose an enemy ship at Range 1.  If you do, remove that ion token. Then that ship may choose to receive 1 ion token. If it does, discard this card.'''
        'Harpoon Missiles':
            text: '''<strong>Attack (target lock):</strong> Discard this card to perform this attack.%LINEBREAK%If this attack hits, assign the "Harpooned!" Condition to the defender.'''
        'Ordnance Silos':
            text: '''<span class="card-restriction">B/SF-17 Bomber only.</span>%LINEBREAK%When you equip this card, place 3 ordnance tokens on each other equipped %BOMB% Upgrade card. When you are instructed to discard an Upgrade card, you may discard 1 ordnance token on that card instead.'''
        'Trajectory Simulator':
            text: '''You may launch bombs using the (%STRAIGHT% 5) template instead of dropping them.  You cannot launch bombs with the "<strong>Action:</strong>" header in this way.'''


        #New EPTs#
        "Luke Skywalker.":
            text: '''When defending, you may change 1 of your %FOCUS% results to a %EVADE% result.'''
        "Biggs Darklighter":
            text: '''Other friendly ships at Range 1 cannot be targeted by attacks if the attacker could target you instead.'''
        '"Night Beast"':
            text: '''After executing a green maneuver, you may perform a free focus action.'''
        '"Dark Curse"':
            text: '''When defending, ships attacking you cannot spend focus tokens or reroll attack dice.'''
        '"Mauler Mithel"':
            text: '''When attacking at Range 1, roll 1 additional attack die.'''
        "Wedge Antilles":
            text: '''When attacking, reduce the defender's agility value by 1 (to a minimum of "0").'''
        "Garven Dreis":
            text: '''After spending a focus token, you may place that token on any other friendly ship at Range 1-2 (instead of discarding it).'''
        '"Dutch" Vander':
            text: '''After acquiring a target lock, choose another friendly ship at Range 1-2.  The chosen ship may immediately acquire a target lock.'''
        "Horton Salm":
            text: '''When attacking at Range 2-3, you may reroll any of your blank results.'''
        '"Winged Gundark"':
            text: '''When attacking at Range 1, you may change 1 of your %HIT% results to a %CRIT% result.'''
        '"Backstabber"':
            text: '''When attacking from outside the defender's firing arc, roll 1 additional attack die.'''
        '"Howlrunner"':
            text: '''When another friendly ship at Range 1 is attacking with its primary weapon, it may reroll 1 attack die.'''
        "Maarek Stele":
            text: '''When your attack deals a faceup Damage card to the defender, instead draw 3 Damage cards, choose 1 to deal, and discard the others.'''
        "Darth Vader.":
            text: '''During your "Perform Action" step, you may perform 2 actions.'''
        "\"Fel's Wrath\"":
            text: '''When the number of Damage cards assigned to you equals or exceeds your hull value, you are not destroyed until the end of the Combat phase.'''
        "Turr Phennir":
            text: '''After you perform an attack, you may perform a free boost or barrel roll action.'''
        "Soontir Fel":
            text: '''When you receive a stress token, you may assign 1 focus token to your ship.'''
        "Tycho Celchu":
            text: '''You may perform actions even while you have stress tokens.'''
        "Arvel Crynyd":
            text: '''You may declare an enemy ship inside your firing arc that you are touching as the target of your attack.'''
        "Chewbacca.":
            text: '''When you are dealt a faceup Damage card, immediately flip it facedown (without resolving its ability).'''
        "Lando Calrissian.":
            text: '''After you execute a green maneuver, choose 1 other friendly ship at Range 1.  That ship may perform 1 free action shown on its action bar.'''
        "Han Solo.":
            text: '''When attacking, you may reroll all of your dice.  If you choose to do so, you must reroll as many of your dice as possible.'''
        "Kath Scarlet":
            text: '''When attacking, the defender receives 1 stress token if he cancels at least 1 %CRIT% result.'''
        "Boba Fett.":
            text: '''When you reveal a bank maneuver (%BANKLEFT% or %BANKRIGHT%), you may rotate your dial to the other bank maneuver of the same speed.'''
        "Krassis Trelix":
            text: '''When attacking with a secondary weapon, you may reroll 1 attack die.'''
        "Ten Numb":
            text: '''When attacking, 1 of your %CRIT% results cannot be canceled by defense dice.'''
        "Ibtisam":
            text: '''When attacking or defending, if you have at least 1 stress token, you may reroll 1 of your dice.'''
        "Roark Garnet":
            text: '''At the start of the Combat phase, choose 1 other friendly ship at Range 1-3.  Until the end of the phase, treat that ship's pilot skill value as "12."'''
        "Kyle Katarn.":
            text: '''At the start of the Combat phase, you may assign 1 of your focus tokens to another friendly ship at Range 1-3.'''
        "Jan Ors.":
            text: '''When another friendly ship at Range 1-3 is attacking, if you have no stress tokens, you may receive 1 stress token to allow that ship to roll 1 additional attack die.'''
        "Captain Jonus":
            text: '''When another friendly ship at Range 1 attacks with a secondary weapon, it may reroll up to 2 attack dice.'''
        "Major Rhymer":
            text: '''When attacking with a secondary weapon, you may increase or decrease the weapon range by 1 to a limit of Range 1-3.'''
        "Captain Kagi":
            text: '''When an enemy ship acquires a target lock, it must lock onto your ship if able.'''
        "Colonel Jendon":
            text: '''At the start of the Combat phase, you may assign 1 of your blue target lock tokens to a friendly ship at Range 1 if it does not have a blue target lock token.'''
        "Captain Yorr":
            text: '''When another friendly ship at Range 1-2 would receive a stress token, if you have 2 or fewer stress tokens, you may receive that token instead.'''
        "Lieutenant Blount":
            text: '''When attacking, the defender is hit by your attack, even if he does not suffer any damage.'''
        "Airen Cracken":
            text: '''After you perform an attack, you may choose another friendly ship at Range 1.  That ship may perform 1 free action.'''
        "Colonel Vessery":
            text: '''When attacking, immediately after you roll attack dice, you may acquire a target lock on the defender if it already has a red target lock token.'''
        "Rexler Brath":
            text: '''After you perform an attack that deals at least 1 Damage card to the defender, you may spend a focus token to flip those cards faceup.'''
        "Etahn A'baht":
            text: '''When an enemy ship inside your firing arc at Range 1-3 is defending, the attacker may change 1 of its %HIT% results to a %CRIT% result.'''
        "Corran Horn":
            text: '''At the start of the End phase, you may perform one attack.  You cannot attack during the next round.'''
        '"Echo"':
            text: '''When you decloak, you must use the (%BANKLEFT% 2) or (%BANKRIGHT% 2) template instead of the (%STRAIGHT% 2) template.'''
        '"Whisper"':
            text: '''After you perform an attack that hits, you may assign 1 focus to your ship.'''
        "Lieutenant Lorrir":
            text: '''When performing a barrel roll action, you may receive 1 stress token to use the (%BANKLEFT% 1) or (%BANKRIGHT% 1) template instead of the (%STRAIGHT% 1) template.'''
        "Tetran Cowall":
            text: '''When you reveal a %UTURN% maneuver, you may treat the speed of that maneuver as "1," "3," or "5".'''
        "Kir Kanos":
            text: '''When attacking at Range 2-3, you may spend 1 evade token to add 1 %HIT% result to your roll.'''
        "Carnor Jax":
            text: '''Enemy ships at Range 1 cannot perform focus or evade actions and cannot spend focus or evade tokens.'''
        "Dash Rendar.":
            text: '''You may ignore obstacles during the Activation phase and when performing actions.'''
        '"Leebo".':
            text: '''When you are dealt a faceup Damage card, draw 1 additional Damage card, choose 1 to resolve, and discard the other.'''
        "Eaden Vrill":
            text: '''When performing a primary weapon attack against a stressed ship, roll 1 additional attack die.'''
        "Rear Admiral Chiraneau":
            text: '''When attacking at Range 1-2, you may change 1 of your %FOCUS% results to a %CRIT% result.'''
        "Commander Kenkirk":
            text: '''If you have no shields and at least 1 Damage card assigned to you, increase your agility value by 1.'''
        "Captain Oicunn":
            text: '''After executing a maneuver, each enemy ship you are touching suffers 1 damage.'''
        "Wes Janson":
            text: '''After you perform an attack, you may remove 1 focus, evade, or blue target lock token from the defender.'''
        "Jek Porkins":
            text: '''When you receive a stress token, you may remove it and roll 1 attack die.  On a %HIT% result, deal 1 facedown Damage card to this ship.'''
        '"Hobbie" Klivian':
            text: '''When you acquire or spend a target lock, you may remove 1 stress token from your ship.'''
        "Tarn Mison":
            text: '''When an enemy ship declares you as the target of an attack, you may acquire a target lock on that ship.'''
        "Jake Farrell":
            text: '''After you perform a focus action or are assigned a focus token, you may perform a free boost or barrel roll action.'''
        "Gemmer Sojan":
            text: '''While you are at Range 1 of at least 1 enemy ship, increase your agility value by 1.'''
        "Keyan Farlander":
            text: '''When attacking, you may remove 1 stress token to change all of your %FOCUS% results to %HIT%results.'''
        "Nera Dantels":
            text: '''You can perform %TORPEDO% secondary weapon attacks against enemy ships outside your firing arc.'''
        "Prince Xizor":
            text: '''When defending, a friendly ship at Range 1 may suffer 1 uncanceled %HIT% or %CRIT% result instead of you.'''
        "Guri":
            text: '''At the start of the Combat phase, if you are at Range 1 of an enemy ship, you may assign 1 focus token to your ship.'''
        "Serissu":
            text: '''When another friendly ship at Range 1 is defending, it may reroll 1 defense die.'''
        "Laetin A'shera":
            text: '''After you defend against an attack, if the attack did not hit, you may assign 1 evade token to your ship.'''
        "IG-88A":
            text: '''After you perform an attack that destroys the defender, you may recover 1 shield.'''
        "IG-88B":
            text: '''Once per round, after you perform an attack that does not hit, you may perform an attack with an equipped %CANNON% secondary weapon.'''
        "IG-88C":
            text: '''After you perform a boost action, you may perform a free evade action.'''
        "IG-88D.":
            text: '''You may execute the (%SLOOPLEFT% 3) or (%SLOOPRIGHT% 3) maneuver using the corresponding (%TURNLEFT% 3) or (%TURNRIGHT% 3) template.'''
        "Boba Fett (Scum).":
            text: '''When attacking or defending, you may reroll 1 of your dice for each enemy ship at Range 1.'''
        "Kath Scarlet (Scum)":
            text: '''When attacking a ship inside your auxiliary firing arc, roll 1 additional attack die.'''
        "Emon Azzameen":
            text: '''When dropping a bomb, you may use the (%TURNLEFT% 3), (%STRAIGHT% 3), or (%TURNRIGHT% 3) template instead of the (%STRAIGHT% 1) template.'''
        "Kavil":
            text: '''When attacking a ship outside your firing arc, roll 1 additional attack die.'''
        "Drea Renthal":
            text: '''After you spend a target lock, you may receive 1 stress token to acquire a target lock.'''
        "Dace Bonearm":
            text: '''When an enemy ship at Range 1-3 receives at least 1 ion token, if you are not stressed, you may receive 1 stress token to cause that ship to suffer 1 damage.'''
        "Palob Godalhi":
            text: '''At the start of the Combat phase, you may remove 1 focus or evade token from an enemy ship at Range 1-2 and assign it to yourself.'''
        "Torkil Mux":
            text: '''At the end of the Activation phase, choose 1 enemy ship at Range 1-2. Until the end of the Combat phase, treat that ship's pilot skill value as "0".'''
        "N'Dru Suhlak":
            text: '''When attacking, if there are no other friendly ships at Range 1-2, roll 1 additional attack die.'''
        "Kaa'to Leeachos":
            text: '''At the start of the Combat phase, you may remove 1 focus or evade token from another friendly ship at Range 1-2 and assign it to yourself.'''
        "Commander Alozen":
            text: '''At the start of the Combat phase, you may acquire a target lock on an enemy ship at Range 1.'''
        "Bossk.":
            text: '''When you perform an attack that hits, before dealing damage, you may cancel 1 of your %CRIT% results to add 2 %HIT% results.'''
        "Talonbane Cobra":
            text: '''When attacking or defending, double the effect of your range combat bonuses.'''
        "Miranda Doni":
            text: '''Once per round when attacking, you may either spend 1 shield to roll 1 additional attack die <strong>or</strong> roll 1 fewer attack die to recover 1 shield.'''
        '"Redline"':
            text: '''You may maintain 2 target locks on the same ship.  When you acquire a target lock, you may acquire a second lock on that ship.'''
        '"Deathrain"':
            text: '''When dropping a bomb, you may use the front guides of your ship.  After dropping a bomb, you may perform a free barrel roll action.'''
        "Juno Eclipse":
            text: '''When you reveal your maneuver, you may increase or decrease its speed by 1 (to a minimum of 1).'''
        "Zertik Strom":
            text: '''Enemy ships at Range 1 cannot add their range combat bonus when attacking.'''
        "Lieutenant Colzet":
            text: '''At the start of the End phase, you may spend a target lock you have on an enemy ship to flip 1 random facedown Damage card assigned to it faceup.'''
        "Latts Razzi.":
            text: '''When a friendly ship declares an attack, you may spend a target lock you have on the defender to reduce its agility by 1 for that attack.'''
        "Graz the Hunter":
            text: '''When defending, if the attacker is inside your firing arc, roll 1 additional defense die.'''
        "Esege Tuketu":
            text: '''When another friendly ship at Range 1-2 is attacking, it may treat your focus tokens as its own.'''
        "Moralo Eval":
            text: '''You can perform %CANNON% secondary attacks against ships inside your auxiliary firing arc.'''
        '"Scourge"':
            text: '''When attacking a defender that has 1 or more Damage cards, roll 1 additional attack die.'''        
        '"Youngster"':
            text: '''You may equip Action: EPTs. Friendly TIE fighters at range 1-3 may perform the action on your equipped EPT upgrade card.'''
        '"Wampa"':
            text: '''When attacking, you may cancel all die results.  If you cancel a %CRIT% result, deal 1 facedown Damage card to the defender.'''
        '"Chaser"':
            text: '''When another friendly ship at Range 1 spends a focus token, assign a focus token to your ship.'''
        "The Inquisitor":
            text: '''When attacking with your primary weapon at Range 2-3, treat the range of the attack as Range 1.'''
        "Zuckuss.":
            text: '''When attacking, you may roll 1 additional attack die.  If you do, the defender rolls 1 additional defense die.'''
        "Dengar.":
            text: '''Once per round after defending, if the attacker is inside your firing arc, you may perform an attack against that ship.'''
        "Poe Dameron":
            text: '''When attacking or defending, if you have a focus token, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result.'''
        '"Blue Ace"':
            text: '''When performing a boost action, you may use the (%TURNLEFT% 1) or (%TURNRIGHT% 1) template.'''
        '"Omega Ace"':
            text: '''When attacking, you may spend a focus token and a target lock you have on the defender to change all of your results to %CRIT% results.'''
        '"Epsilon Leader"':
            text: '''At the start of the Combat phase, remove 1 stress token from each friendly ship at Range 1.'''
        '"Zeta Ace"':
            text: '''When performing a barrel roll you may use the (%STRAIGHT% 2) template instead of the (%STRAIGHT% 1) template.'''
        '"Red Ace"':
            text: '''The first time you remove a shield token from your ship each round, assign 1 evade token to your ship.'''
        '"Omega Leader"':
            text: '''Enemy ships that you have locked cannot modify any dice when attacking you or defending against your attacks.'''
        'Hera Syndulla.':
            text: '''When you reveal a green or red maneuver, you may rotate your dial to another maneuver of the same difficulty.'''
        'Ezra Bridger.':
            text: '''When defending, if you are stressed, you may change up to 2 of your %FOCUS% results to %EVADE% results.'''
        '"Zeta Leader"':
            text: '''When attacking, if you are not stressed, you may receive 1 stress token to roll 1 additional die.'''
        '"Epsilon Ace"':
            text: '''While you do not have any Damage cards, treat your pilot skill value as "12."'''
        "Kanan Jarrus.":
            text: '''When an enemy ship at Range 1-2 is attacking, you may spend a focus token.  If you do, the attacker rolls 1 fewer attack die.'''
        '"Chopper".':
            text: '''At the start of the Combat phase, each enemy ship you are touching receives 1 stress token.'''
        'Sabine Wren.':
            text: '''Immediately before you reveal your maneuver, you may perform a free boost or barrel roll action.'''
        '"Zeb" Orrelios.':
            text: '''When defending, you may cancel %CRIT% results before %HIT% results.'''
        'Tomax Bren':
            text: '''You may equip discardable EPTs. Once per round after you discard an EPT upgrade card, flip that card faceup.'''
        'Ello Asty':
            text: '''While you are not stressed, you may treat your %TROLLLEFT% and %TROLLRIGHT% maneuvers as white maneuvers.'''
        "Valen Rudor":
            text: '''After defending, you may perform a free action.'''
        "4-LOM.":
            text: '''At the start of the End phase, you may assign 1 of your stress tokens to another ship at Range 1.'''
        "Tel Trevura":
            text: '''The first time you would be destroyed, instead cancel any remaining damage, discard all Damage cards, and deal 4 facedown Damage cards to this ship.'''
        "Manaroo":
            text: '''At the start of the Combat phase, you may assign all focus, evade, and target lock tokens assigned to you to another friendly ship at Range 1.'''
        '"Deathfire"':
            text: '''When you reveal your maneuver dial or after you perform an action, you may perform a %BOMB% Upgrade card action as a free action.'''
        "Maarek Stele (TIE Defender)":
            text: '''When your attack deals a faceup Damage card to the defender, instead draw 3 Damage cards, choose 1 to deal, and discard the others.'''
        "Countess Ryad":
            text: '''When you reveal a %STRAIGHT% maneuver, you may treat it as a %KTURN% maneuver.'''
        'Norra Wexley':
            text: '''When attacking or defending, you may spend a target lock you have on the enemy ship to add 1 %FOCUS% result to your roll.'''
        'Shara Bey':
            text: '''When another friendly ship at Range 1-2 is attacking, it may treat your blue target lock tokens as its own.'''
        'Thane Kyrell':
            text: '''After an enemy ship in your firing arc at Range 1-3 attacks another friendly ship, you may perform a free action.'''
        'Braylen Stramm':
            text: '''After you execute a maneuver, you may roll an attack die.  On a %HIT% or %CRIT% result, remove 1 stress token from your ship.'''
        '"Quickdraw"':
            text: '''Once per round, when you lose a shield token, you may perform a primary weapon attack.'''
        '"Backdraft"':
            text: '''When attacking a ship inside your auxiliary firing arc, you may add 1 %CRIT% result.'''
        'Fenn Rau':
            text: '''When attacking or defending, if the enemy ship is at Range 1, you may roll 1 additional die.'''
        'Old Teroch':
            text: '''At the start of the Combat phase, you may choose 1 enemy ship at Range 1.  If you are inside its firing arc, it discards all focus and evade tokens.'''
        'Kad Solus':
            text: '''After you execute a red maneuver, assign 2 focus tokens to your ship.'''
        'Ketsu Onyo.':
            text: '''At the start of the Combat phase, you may choose a ship at Range 1.  If it is inside your primary <strong>and</strong> mobile firing arcs, assign 1 tractor beam token to it.'''
        'Asajj Ventress':
            text: '''At the start of the Combat phase, you may choose a ship at Range 1-2.  If it is inside your mobile firing arc, assign 1 stress token to it.'''
        'Sabine Wren (Scum)':
            text: '''When defending against an enemy ship inside your mobile firing arc at Range 1-2, you may add 1 %FOCUS% result to your roll.'''
        "Poe Dameron (PS9)":
            text: '''When attacking or defending, if you have a focus token, you may change 1 of your %FOCUS% results to a %HIT% or %EVADE% result.'''
        "Rey.":
            text: '''When attacking or defending, if the enemy ship is inside of your firing arc, you may reroll up to 2 of your blank results.'''
        'Han Solo (TFA)':
            text: '''When you are placed during setup, you can be placed anywhere in the play area beyond Range 3 of enemy ships.'''
        'Chewbacca (TFA)':
            text: '''After another friendly ship at Range 1-3 is destroyed (but has not fled the battlefield), you may perform an attack.'''
        'Kylo Ren.':
            text: '''The first time you are hit by an attack each round, deal the "I'll Show You the Dark Side" Condition card to the attacker.'''
        'Unkar Plutt.':
            text: '''At the end of the Activation phase, you <strong>must</strong> assign a tractor beam token to each ship you are touching.'''
        'Cassian Andor.':
            text: '''At the start of the Activation phase, you may remove 1 stress token from 1 other friendly ship at Range 1-2.'''
        'Bodhi Rook.':
            text: '''When a friendly ship acquires a target lock, that ship can lock onto an enemy ship at Range 1-3 of any friendly ship.'''
        'Heff Tobber':
            text: '''After an enemy ship executes a maneuver that causes it to overlap your ship, you may perform a free action.'''
        '''"Duchess"''':
            text: '''While you have the "Adaptive Ailerons" Upgrade card equipped, you may choose to ignore its card ability.'''
        '''"Pure Sabacc"''':
            text: '''When attacking, if you have 1 or fewer Damage cards, roll 1 additional attack die.'''
        '''"Countdown"''':
            text: '''When defending, if you are not stressed, during the "Compare Results" step, you may suffer 1 damage to cancel all dice results.  If you do, receive 1 stress token.'''
        'Nien Nunb.':
            text: '''When you receive a stress token, if there is an enemy ship inside your firing arc at Range 1, you may discard that stress token.'''
        '"Snap" Wexley':
            text: '''After you execute a 2-, 3-, or 4-speed maneuver, if you are not touching a ship, you may perform a free boost action.'''
        'Jess Pava':
            text: '''When attacking or defending, you may reroll 1 of your dice for each other friendly ship at Range 1.'''
        'Ahsoka Tano':
            text: '''At the start of the Combat phase, you may spend 1 focus token to choose a friendly ship at Range 1.  It may perform 1 free action.'''
        'Captain Rex.':
            text: '''After you perform an attack, assign the "Suppressive Fire" Condition card to the defender.'''
        'Major Stridan':
            text: '''For the purpose of your actions and Upgrade cards, you may treat friendly ships at Range 2-3 as being at Range 1.'''
        'Lieutenant Dormitz':
            text: '''During setup, friendly ships may placed anywhere in the play area at Range 1-2 of you.'''
        'Constable Zuvio':
            text: '''When you reveal a reverse maneuver, you may drop a bomb using your front guides (including a bomb with the "<strong>Action:</strong>" header).'''
        'Sarco Plank':
            text: '''When defending, instead of using your agility value, you may roll a number of defense dice equal to the speed of the maneuver you executed this round.'''
        'Genesis Red':
            text: '''After you acquire a target lock, assign focus and evade tokens to your ship until you have the same number of each token as the locked ship.'''
        'Quinn Jast':
            text: '''At the start of the Combat phase, you may receive a weapons disabled token to flip one of your discarded %TORPEDO% or %MISSILE% Upgrade cards faceup.'''
        'Inaldra':
            text: '''When attacking or defending, you may spend 1 shield to reroll any number of your dice.'''
        'Sunny Bounder':
            text: '''Once per round, after you roll or reroll dice, if you have the same result on each of your dice, add 1 matching result.'''
        'Lieutenant Kestal':
            text: '''When attacking, you may spend 1 focus token to cancel all of the defender's blank and %FOCUS% results.'''
        '"Double Edge"':
            text: '''Once per round, after you perform a secondary weapon attack that does not hit, you may perform an attack with a different weapon.'''
        'Viktor Hel':
            text: '''After defending, if you did not roll exactly 2 defense dice, the attacker receives 1 stress token.'''
        'Lowhhrick':
            text: '''When another friendly ship at Range 1 is defending, you may spend 1 reinforce token. If you do, the defender adds 1 %EVADE% result.'''
        'Wullffwarro':
            text: '''When attacking, if you have no shields and at least 1 Damage card assigned to you, roll 1 additional attack die.'''
        'Captain Nym':
            text: '''You may ignore friendly bombs. When a friendly ship is defending, if the attacker measures range through a friendly bomb token, the defender may add 1 %EVADE% result.'''
        'Captain Nym (Rebel)':
            text: '''Once per round, you may prevent a friendly bomb from detonating.'''
        'Sol Sixxa':
            text: '''When dropping a bomb, you may use the (%TURNLEFT% 1) or (%TURNRIGHT% 1) template instead of the (%STRAIGHT% 1) template.'''
        'Dalan Oberos':
            text: '''If you are not stressed, when you reveal a turn, bank, or Segnor's Loop maneuver, you may instead treat it as a red Tallon Roll maneuver of the same direction (left or right) using the template of the original revealed maneuver.'''
        'Thweek':
            text: '''During setup, before the "Place Forces" step, you may choose 1 enemy ship and assign the "Shadowed" or "Mimicked" Condition card to it.'''
        'Captain Jostero':
            text: '''Once per round, after an enemy ship that is not defending against an attack suffers damage or critical damage, you may perform an attack against that ship.'''

    modification_translations =
        "Stealth Device":
            text: """Increase your agility value by 1.  If you are hit by an attack, discard this card."""
        "Shield Upgrade":
            text: """Increase your shield value by 1."""
        "Engine Upgrade":
            text: """Your action bar gains the %BOOST% action icon."""
        "Anti-Pursuit Lasers":
            text: """%LARGESHIPONLY%%LINEBREAK%After an enemy ship executes a maneuver that causes it to overlap your ship, roll 1 attack die.  On a %HIT% or %CRIT% result, the enemy ship suffers 1 damage."""
        "Targeting Computer":
            text: """Your action bar gains the %TARGETLOCK% action icon."""
        "Hull Upgrade":
            text: """Increase your hull value by 1."""
        "Munitions Failsafe":
            text: """When attacking with a secondary weapon that instructs you to discard it to perform the attack, do not discard it unless the attack hits."""
        "Stygium Particle Accelerator":
            text: """When you either decloak or perform a cloak action, you may perform a free evade action."""
        "Advanced Cloaking Device":
            text: """<span class="card-restriction">TIE Phantom only.</span>%LINEBREAK%After you perform an attack, you may perform a free cloak action."""
        "Combat Retrofit":
            text: """<span class="card-restriction">GR-75 only.</span>%LINEBREAK%Increase your hull value by 2 and your shield value by 1."""
        "B-Wing/E2":
            text: """<span class="card-restriction">B-Wing only.</span>%LINEBREAK%Your upgrade bar gains the %CREW% upgrade icon."""
        "Countermeasures":
            text: """%LARGESHIPONLY%%LINEBREAK%At the start of the Combat phase, you may discard this card to increase your agility value by 1 until the end of the round.  Then you may remove 1 enemy target lock from your ship."""
        "Experimental Interface":
            text: """Once per round, after you perform an action, you may perform 1 free action from an equipped Upgrade card with the "<strong>Action:</strong>" header.  Then receive 1 stress token."""
        "Tactical Jammer":
            text: """%LARGESHIPONLY%%LINEBREAK%Your ship can obstruct enemy attacks."""
        "Autothrusters":
            text: """When defending, if you are beyond Range 2 or outside the attacker's firing arc, you may change 1 of your blank results to a %EVADE% result. You can equip this card only if you have the %BOOST% action icon."""
        "Advanced SLAM":
            text: """After performing a SLAM action, if you did not overlap an obstacle or another ship, you may perform a free action."""
        "Twin Ion Engine Mk. II":
            text: """<span class="card-restriction">TIE only.</span>%LINEBREAK%You may treat all bank maneuvers (%BANKLEFT% and %BANKRIGHT%) as green maneuvers."""
        "Maneuvering Fins":
            text: """<span class="card-restriction">YV-666 only.</span>%LINEBREAK%When you reveal a turn maneuver (%TURNLEFT% or %TURNRIGHT%), you may rotate your dial to the corresponding bank maneuver (%BANKLEFT% or %BANKRIGHT%) of the same speed."""
        "Ion Projector":
            text: """%LARGESHIPONLY%%LINEBREAK%After an enemy ship executes a maneuver that causes it to overlap your ship, roll 1 attack die.  On a %HIT% or %CRIT% result, the enemy ship receives 1 ion token."""
        'Integrated Astromech':
            text: '''<span class="card-restriction">X-wing only.</span>%LINEBREAK%When you are dealt a Damage card, you may discard 1 of your %ASTROMECH% Upgrade cards to discard that Damage card.'''
        'Optimized Generators':
            text: '''%HUGESHIPONLY%%LINEBREAK%Once per round, when you assign energy to an equipped Upgrade card, gain 2 energy.'''
        'Automated Protocols':
            text: '''%HUGESHIPONLY%%LINEBREAK%Once per round, after you perform an action that is not a recover or reinforce action, you may spend 1 energy to perform a free recover or reinforce action.'''
        'Ordnance Tubes':
            text: '''%HUGESHIPONLY%%LINEBREAK%You may treat each of your %HARDPOINT% upgrade icons as a %TORPEDO% or %MISSILE% icon.%LINEBREAK%When you are instructed to discard a %TORPEDO% or %MISSILE% Upgrade card, do not discard it.'''
        'Long-Range Scanners':
            text: '''You can acquire target locks on ships at Range 3 and beyond.  You cannot acquire target locks on ships at Range 1-2.  You can equip this card only if you have %TORPEDO% and %MISSILE% in your upgrade bar.'''
        "Guidance Chips":
            text: """Once per round, when attacking with a %TORPEDO% or %MISSILE% secondary weapon, you may change 1 die result to a %HIT% result (or a %CRIT% result if your primary weapon value is "3" or higher)."""
        'Vectored Thrusters':
            text: '''%SMALLSHIPONLY%%LINEBREAK%Your action bar gains the %BARRELROLL% action icon.'''
        'Smuggling Compartment':
            text: '''<span class="card-restriction">YT-1300 and YT-2400 only.</span>%LINEBREAK%Your upgrade bar gains the %ILLICIT% upgrade icon.%LINEBREAK%You may equip 1 additional Modification upgrade that costs 3 or fewer squad points.'''
        'Gyroscopic Targeting':
            text: '''<span class="card-restriction">Lancer-class Pursuit Craft only.</span>%LINEBREAK%At the end of the Combat phase, if you executed a 3-, 4-, or 5-speed maneuver this round, you may rotate your mobile firing arc.'''
        'Captured TIE':
            text: '''<span class="card-restriction">TIE Fighter only.</span> %REBELONLY%%LINEBREAK%Enemy ships with a pilot skill value lower than yours cannot declare you as the target of an attack.  After you perform an attack or when you are the only remaining friendly ship, discard this card.'''
        'Spacetug Tractor Array':
            text: '''<span class="card-restriction">Quadjumper only.</span>%LINEBREAK%<strong>Action:</strong> Choose a ship inside your firing arc at Range 1 and assign a tractor beam token to it.  If it is a friendly ship, resolve the effect of the tractor beam token as though it were an enemy ship.'''
        'Lightweight Frame':
            text: '''<span class="card-restriction">TIE only.</span>%LINEBREAK%When defending, after rolling defense dice, if there are more attack dice than defense dice, roll 1 additional defense die.%LINEBREAK%You cannot equip this card if your agility value is "3" or higher.'''
        'Pulsed Ray Shield':
            text: '''<span class="card-restriction">Rebel and Scum only.</span>%LINEBREAK%During the End phase, you may receive 1 ion token to recover 1 shield (up to your shield value). You can equip this card only if your shield value is "1."'''

    title_translations =
        "Slave I":
            text: """<span class="card-restriction">Firespray-31 only.</span>%LINEBREAK%Your upgrade bar gains the %TORPEDO% upgrade icon."""
        "Millennium Falcon":
            text: """<span class="card-restriction">YT-1300 only.</span>%LINEBREAK%Your action bar gains the %EVADE% action icon."""
        "Moldy Crow":
            text: """<span class="card-restriction">HWK-290 only.</span>%LINEBREAK%During the End phase, do not remove unused focus tokens from your ship."""
        "ST-321":
            text: """<span class="card-restriction"><em>Lambda</em>-class Shuttle only.</span>%LINEBREAK%When acquiring a target lock, you may lock onto any enemy ship in the play area."""
        "Royal Guard TIE":
            text: """<span class="card-restriction">TIE Interceptor only.</span>%LINEBREAK%You may equip up to 2 different Modification upgrades (instead of 1).%LINEBREAK%You cannot equip this card if your pilot skill value is "4" or lower."""
        "Dodonna's Pride":
            text: """<span class="card-restriction">CR90 fore section only.</span>%LINEBREAK%When you perform a coordinate action, you may choose 2 friendly ships (instead of 1).  Those ships may each perform 1 free action."""
        "A-Wing Test Pilot":
            text: """<span class="card-restriction">A-Wing only.</span>%LINEBREAK%Your upgrade bar gains 1 %ELITE% upgrade icon.%LINEBREAK%You cannot equip 2 of the same %ELITE% Upgrade cards.  You cannot equip this if your pilot skill value is "1" or lower."""
        "Tantive IV":
            text: """<span class="card-restriction">CR90 fore section only.</span>%LINEBREAK%Your fore section upgrade bar gains 1 additional %CREW% and 1 additional %TEAM% upgrade icon."""
        "Bright Hope":
            text: """<span class="card-restriction">GR-75 only.</span>%LINEBREAK%A reinforce action assigned to your fore section adds 2 %EVADE% results (instead of 1)."""
        "Quantum Storm":
            text: """<span class="card-restriction">GR-75 only.</span>%LINEBREAK%At the start of the End phase, if you have 1 or fewer energy tokens, gain 1 energy token."""
        "Dutyfree":
            text: """<span class="card-restriction">GR-75 only.</span>%LINEBREAK%When performing a jam action, you may choose an enemy ship at Range 1-3 (instead of at Range 1-2)."""
        "Jaina's Light":
            text: """<span class="card-restriction">CR90 fore section only.</span>%LINEBREAK%When defending, once per attack, if you are dealt a faceup Damage card, you may discard it and draw another faceup Damage card."""
        "Outrider":
            text: """<span class="card-restriction">YT-2400 only.</span>%LINEBREAK%While you have a %CANNON% Upgrade card equipped, you <strong>cannot</strong> perform primary weapon attacks and you may perform %CANNON% secondary weapon attacks against ships outside your firing arc."""
        "Dauntless":
            text: """<span class="card-restriction">VT-49 Decimator only.</span>%LINEBREAK%After you execute a maneuver that causes you to overlap another ship, you may perform 1 free action.  Then receive 1 stress token."""
        "Virago":
            text: """<span class="card-restriction">StarViper only.</span>%LINEBREAK%Your upgrade bar gains the %SYSTEM% and %ILLICIT% upgrade icons.%LINEBREAK%You cannot equip this card if your pilot skill value is "3" or lower."""
        '"Heavy Scyk" Interceptor (Cannon)':
            text: """<span class="card-restriction">M3-A Interceptor only.</span>%LINEBREAK%Your upgrade bar gains the %CANNON%, %TORPEDO%, or %MISSILE% upgrade icon.%LINEBREAK%Increase your hull value by 1."""
        '"Heavy Scyk" Interceptor (Torpedo)':
            text: """<span class="card-restriction">M3-A Interceptor only.</span>%LINEBREAK%Your upgrade bar gains the %CANNON%, %TORPEDO%, or %MISSILE% upgrade icon.%LINEBREAK%Increase your hull value by 1."""
        '"Heavy Scyk" Interceptor (Missile)':
            text: """<span class="card-restriction">M3-A Interceptor only.</span>%LINEBREAK%Your upgrade bar gains the %CANNON%, %TORPEDO%, or %MISSILE% upgrade icon.%LINEBREAK%Increase your hull value by 1."""
        "IG-2000":
            text: """<span class="card-restriction">Aggressor only.</span> %SCUMONLY%%LINEBREAK%You have the pilot ability of each other friendly ship with the <em>IG-2000</em> Upgrade card (in addition to your own pilot ability)."""
        "BTL-A4 Y-Wing":
            text: """<span class="card-restriction">Y-Wing only.</span>%LINEBREAK%You cannot attack ships outside your firing arc. After you perform a primary weapon attack, you may immediately perform an attack with a %TURRET% secondary weapon."""
        "Andrasta":
            text: """Your upgrade bar gains two additional %BOMB% upgrade icons."""
        "TIE/x1":
            text: """<span class="card-restriction">TIE Advanced only.</span>%LINEBREAK%Your upgrade bar gains the %SYSTEM% upgrade icon.%LINEBREAK%If you equip a %SYSTEM% upgrade, its squad point cost is reduced by 4 (to a minimum of 0)."""
        "Hound's Tooth":
            text: """<span class="card-restriction">YV-666 only.</span>%LINEBREAK%After you are destroyed, before you are removed from the play area, you may <strong>deploy</strong> the <em>Nashtah Pup</em> ship.%LINEBREAK%It cannot attack this round."""
        "Ghost":
            text: """<span class="card-restriction">VCX-100 only.</span>%LINEBREAK%Equip the <em>Phantom</em> title card to a friendly Attack Shuttle and dock it to this ship.%LINEBREAK%After you execute a maneuver, you may deploy it from your rear guides."""
        "Phantom":
            text: """While you are docked, the <em>Ghost</em> can perform primary weapon attacks from its special firing arc, and, at the end of the Combat phase, it may perform an additional attack with an equipped %TURRET%. If it performs this attack, it cannot attack again this round."""
        "TIE/v1":
            text: """<span class="card-restriction">TIE Advanced Prototype only.</span>%LINEBREAK%After you acquire a target lock, you may perform a free evade action."""
        "Mist Hunter":
            text: """<span class="card-restriction">G-1A starfighter only.</span>%LINEBREAK%Your action bar gains the %BARRELROLL% action icon.%LINEBREAK%You <strong>must</strong> equip 1 "Tractor Beam" Upgrade card (paying its squad point cost as normal)."""
        "Punishing One":
            text: """<span class="card-restriction">JumpMaster 5000 only.</span>%LINEBREAK%Increase your primary weapon value by 1."""
        "Assailer":
            text: """<span class="card-restriction"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%When defending, if the targeted section has a reinforce token, you may change 1 %FOCUS% result to a %EVADE% result."""
        "Instigator":
            text: """<span class="card-restriction"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%After you perform a recover action, recover 1 additional shield."""
        "Impetuous":
            text: """<span class="card-restriction"><em>Raider</em>-class corvette aft section only.</span>%LINEBREAK%After you perform an attack that destroys an enemy ship, you may acquire a target lock."""
        'TIE/x7':
            text: '''<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Your upgrade bar loses the %CANNON% and %MISSILE% upgrade icons.%LINEBREAK%After executing a 3-, 4-, or 5-speed maneuver, if you did not overlap an obstacle or ship, you may perform a free evade action.'''
        'TIE/D':
            text: '''<span class="card-restriction">TIE Defender only.</span>%LINEBREAK%Once per round, after you perform an attack with a %CANNON% secondary weapon that costs 3 or fewer squad points, you may perform a primary weapon attack.'''
        'TIE Shuttle':
            text: '''<span class="card-restriction">TIE Bomber only.</span>%LINEBREAK%Your upgrade bar loses all %TORPEDO%, %MISSILE%, and %BOMB% upgrade icons and gains 2 %CREW% upgrade icons.  You cannot equip a %CREW% Upgrade card that costs more than 4 squad points.'''
        'Requiem':
            text: '''%GOZANTIONLY%%LINEBREAK%When you deploy a ship, treat its pilot skill value as "8" until the end of the round.'''
        'Vector':
            text: '''%GOZANTIONLY%%LINEBREAK%After you execute a maneuver, you may deploy up to 4 attached ships (instead of 2).'''
        'Suppressor':
            text: '''%GOZANTIONLY%%LINEBREAK%Once per round, after you acquire a target lock, you may remove 1 focus, evade, or blue target lock token from that ship.'''
        'Black One':
            text: '''After you perform a boost or barrel roll action, you may remove 1 enemy target lock from a friendly ship at Range 1.  You cannot equip this card if your pilot skill is "6" or lower.'''
        'Millennium Falcon (TFA)':
            text: '''After you execute a 3-speed bank maneuver (%BANKLEFT% or %BANKRIGHT%), if you are not touching another ship and you are not stressed, you may receive 1 stress token to rotate your ship 180&deg;.'''
        'Alliance Overhaul':
            text: '''<span class="card-restriction">ARC-170 only.</span>%LINEBREAK%When attacking with a primary weapon from your primary firing arc, you may roll 1 additional attack die.  When attacking from your auxiliary firing arc, you may change 1 of your %FOCUS% results to a %CRIT% result.'''
        'Special Ops Training':
            text: '''<span class="card-restriction">TIE/sf only.</span>%LINEBREAK%When attacking with a primary weapon from your primary firing arc, you may roll 1 additional attack die.  If you do not, you may perform an additional attack from your auxiliary firing arc.'''
        'Concord Dawn Protector':
            text: '''<span class="card-restriction">Protectorate Starfighter only.</span>%LINEBREAK%When defending, if you are inside the attacker's firing arc and at Range 1 and the attacker is inside your firing arc, add 1 %EVADE% result.'''
        'Shadow Caster':
            text: '''<span class="card-restriction">Lancer-class Pursuit Craft only.</span>%LINEBREAK%After you perform an attack that hits, if the defender is inside your mobile firing arc and at Range 1-2, you may assign the defender 1 tractor beam token.'''
        # Wave X
        '''Sabine's Masterpiece''':
            text: '''<span class="card-restriction">TIE Fighter only.</span>%REBELONLY%%LINEBREAK%Your upgrade bar gains the %CREW% and %ILLICIT% upgrade icons.'''
        '''Kylo Ren's Shuttle''':
            text: '''<span class="card-restriction">Upsilon-class Shuttle only.</span>%LINEBREAK%At the end of the Combat phase, choose an unstressed enemy ship at Range 1-2.  Its owner must assign a stress token to it or assign a stress token to another ship at Range 1-2 of you that that player controls.'''
        '''Pivot Wing''':
            text: '''<span class="card-restriction">U-Wing only.</span> %DUALCARD%%LINEBREAK%<strong>Side A (Attack):</strong> Increase your agility by 1.%LINEBREAK%After you execute a maneuver, you may flip this card.%LINEBREAK%<strong>Side B (Landing):</strong> When you reveal a (0 %STOP%) maneuver, you may rotate your ship 180&deg;.%LINEBREAK%After you execute a maneuver, you may flip this card.'''
        '''Adaptive Ailerons''':
            text: '''<span class="card-restriction">TIE Striker only.</span>%LINEBREAK%Immediately before you reveal your dial, if you are not stressed, you <strong>must</strong> execute a white (%BANKLEFT% 1), (%STRAIGHT% 1), or (%BANKRIGHT% 1) maneuver.'''
        # C-ROC
        '''Merchant One''':
            text: '''<span class="card-restriction">C-ROC Cruiser only.</span>%LINEBREAK%Your upgrade bar 1 gains additional %CREW% upgrade icon and 1 additional %TEAM% upgrade icon and loses 1 %CARGO% upgrade icon.'''
        '''"Light Scyk" Interceptor''':
            text: '''<span class="card-restriction">M3-A Interceptor only.</span>%LINEBREAK%All Damage cards dealt to you are dealt faceup.  You may treat all bank maneuvers (%BANKLEFT% or %BANKRIGHT%) as green maneuvers.  You cannot equip Modification upgrades.'''
        '''Insatiable Worrt''':
            text: '''After you perform the recover action, gain 3 energy.'''
        '''Broken Horn''':
            text: '''When defending, if you have a reinforce token, you may add 1 additional %EVADE% result.  If you do, after defending, discard your reinforce token.'''
        'Havoc':
            text: '''<span class="card-restriction">Scurrg H-6 Bomber only.</span>%LINEBREAK%Your upgrade bar gains the %SYSTEM% and %SALVAGEDASTROMECH% icons and loses the %CREW% upgrade icon.%LINEBREAK%You cannot equip non-unique %SALVAGEDASTROMECH% Upgrade cards.'''
        'Vaksai':
            text: '''<span class="card-restriction">Kihraxz Fighter only.</span>%LINEBREAK%The squad point cost of each of your equipped upgrades is reduced by 1 (to a minimum of 0).%LINEBREAK%You may equip up to 3 different Modification upgrades.'''
        'StarViper Mk. II':
            text: '''<span class="card-restriction">StarViper only.</span>%LINEBREAK%You may equip up to 2 different title Upgrades.%LINEBREAK%When performing a barrel roll action, you <strong>must</strong> use the (%BANKLEFT% 1) or (%BANKRIGHT% 1) template instead of the (%STRAIGHT% 1) template.'''
        'XG-1 Assault Configuration':
            text: '''<span class="card-restriction">Alpha-class Star Wing only.</span>%LINEBREAK%Your upgrade bar gains 2 %CANNON% icons.%LINEBREAK%You may perform attacks with %CANNON% secondary weapons that cost 2 or fewer points even while you have a weapons disabled token.'''
        'Enforcer':
            text: '''<span class="card-restriction">M12-L Kimogila Fighter only.</span>%LINEBREAK%After defending, if the attacker is inside your bullseye firing arc, the attacker receives 1 stress token.'''
        'Ghost (Phantom II)':
            text: '''<span class="card-restriction">VCX-100 only.</span>%LINEBREAK%Equip the <em>Phantom II</em> title card to a friendly <em>Sheathipede</em>-class shuttle and dock it to this ship.%LINEBREAK%After you execute a maneuver, you may deploy it from your rear guides.'''
        'Phantom II':
            text: '''While you are docked, the <em>Ghost</em> can perform primary weapon attacks from its special firing arc.%LINEBREAK%While you are docked, at the end of the Activation phase, the <em>Ghost</em> may perform a free coordinate action.'''
        'First Order Vanguard':
            text: '''<span class="card-restriction">TIE Silencer only.</span>%LINEBREAK%When attacking, if the defender is the only ship in your firing arc at Range 1-3, you may reroll 1 attack die.%LINEBREAK%When defending, you may discard this card to reroll all of your defense dice.'''

    condition_translations =
        '''I'll Show You the Dark Side''':
            text: '''When this card is assigned, if it is not already in play, the player who assigned it searches the Damage deck for 1 Damage card with the <strong><em>Pilot</em></strong> trait and may place it faceup on this card. Then shuffle the damage deck.%LINEBREAK%When you suffer critical damage during an attack, you are instead dealt the chosen faceup Damage card.%LINEBREAK%When there is no Damage card on this card, remove it.'''
        'Suppressive Fire':
            text: '''When attacking a ship other than "Captain Rex," roll 1 fewer attack die.%LINEBREAK% When you declare an attack targeting "Captain Rex" or when "Captain Rex" is destroyed, remove this card.%LINEBREAK%At the end of the Combat phase, if "Captain Rex" did not perform an attack this phase, remove this card.'''
        'Fanatical Devotion':
            text: '''When defending, you cannot spend focus tokens.%LINEBREAK%When attacking, if you spend a focus token to change all %FOCUS% results to %HIT% results, set aside the first %FOCUS% result that you change. The set-aside %HIT% result cannot be canceled by defense dice, but the defender may cancel %CRIT% results before it.%LINEBREAK%During the End phase, remove this card.'''
        'A Debt to Pay':
            text: '''When attacking a ship that has the "A Score to Settle" Upgrade card equipped, you may change 1 %FOCUS% result to a %CRIT% result.'''
        'Shadowed':
            text: '''"Thweek" is treated as having the pilot skill value you had after setup.%LINEBREAK%The pilot skill value of "Thweek" does not change if your pilot skill value changes or you are destroyed.'''
        'Mimicked':
            text: '''"Thweek" is treated as having your pilot ability.%LINEBREAK%"Thweek" cannot apply a Condition card by using your pilot ability.%LINEBREAK%"Thweek" does not lose your pilot ability if you are destroyed.'''
        'Harpooned!':
            text: '''When you are hit by an attack, if there is at least 1 uncanceled %CRIT% result, each other ship at Range 1 suffers 1 damage.  Then discard this card and receive 1 facedown Damage card.%LINEBREAK%When you are destroyed, each ship at Range 1 suffers 1 damage.%LINEBREAK%<strong>Action:</strong> Discard this card.  Then roll 1 attack die.  On a %HIT% or %CRIT% result, suffer 1 damage.'''
        'Rattled':
            text: '''When you suffer damage from a bomb, you suffer 1 additional critical damage. Then, remove this card.%LINEBREAK%<strong>Action:</strong> Roll 1 attack die. On a %FOCUS% or %HIT% result, remove this card.'''

    exportObj.setupCardData basic_cards, pilot_translations, upgrade_translations, modification_translations, title_translations, condition_translations

exportObj = exports ? this

String::startsWith ?= (t) ->
    @indexOf t == 0

sortWithoutQuotes = (a, b) ->
    a_name = a.replace /[^a-z0-9]/ig, ''
    b_name = b.replace /[^a-z0-9]/ig, ''
    if a_name < b_name
        -1
    else if a_name > b_name
        1
    else
        0

exportObj.manifestByExpansion =
    'Core': [
        {
            name: 'X-Wing'
            type: 'ship'
            count: 1
        }
        {
            name: 'TIE Fighter'
            type: 'ship'
            count: 2
        }
        {
            name: 'Luke Skywalker'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Luke Skywalker.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Biggs Darklighter'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Biggs Darklighter'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Red Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Rookie Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Mauler Mithel"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Mauler Mithel"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Dark Curse"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Dark Curse"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Night Beast"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Night Beast"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Black Squadron Pilot'
            type: 'pilot'
            count: 2
        }
        {
            name: 'Obsidian Squadron Pilot'
            type: 'pilot'
            count: 2
        }
        {
            name: 'Academy Pilot'
            type: 'pilot'
            count: 2
        }
        {
            name: 'Proton Torpedoes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R2-F2'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R2-D2'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Determination'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Marksmanship'
            type: 'upgrade'
            count: 1
        }
    ]
    'X-Wing Expansion Pack': [
        {
            name: 'X-Wing'
            type: 'ship'
            count: 1
        }
        {
            name: 'Wedge Antilles'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Garven Dreis'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Wedge Antilles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Garven Dreis'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Red Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Rookie Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Proton Torpedoes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R5-K6'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R5 Astromech'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Expert Handling'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Marksmanship'
            type: 'upgrade'
            count: 1
        }
    ]
    'Y-Wing Expansion Pack': [
        {
            name: 'Y-Wing'
            type: 'ship'
            count: 1
        }
        {
            name: 'Horton Salm'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Dutch" Vander'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Horton Salm'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Dutch" Vander'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Gray Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Gold Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Proton Torpedoes'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Ion Cannon Turret'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R5-D8'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R2 Astromech'
            type: 'upgrade'
            count: 1
        }
    ]
    'TIE Fighter Expansion Pack': [
        {
            name: 'TIE Fighter'
            type: 'ship'
            count: 1
        }
        {
            name: '"Howlrunner"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Backstabber"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Winged Gundark"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Howlrunner"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Backstabber"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Winged Gundark"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Black Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Obsidian Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Academy Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Swarm Tactics'
            type: 'upgrade'
            count: 1
        }
    ]
    'TIE Advanced Expansion Pack': [
        {
            name: 'TIE Advanced'
            type: 'ship'
            count: 1
        }
        {
            name: 'Darth Vader'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Maarek Stele'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Darth Vader.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Maarek Stele'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Storm Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Tempest Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Concussion Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Cluster Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Squad Leader'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Swarm Tactics'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Expert Handling'
            type: 'upgrade'
            count: 1
        }
    ]
    'A-Wing Expansion Pack': [
        {
            name: 'A-Wing'
            type: 'ship'
            count: 1
        }
        {
            name: 'Tycho Celchu'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Arvel Crynyd'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Tycho Celchu'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Arvel Crynyd'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Green Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Prototype Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Concussion Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Homing Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Cluster Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Push the Limit'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Deadeye'
            type: 'upgrade'
            count: 1
        }
    ]
    'Millennium Falcon Expansion Pack': [
        {
            name: 'YT-1300'
            type: 'ship'
            count: 1
        }
        {
            name: 'Han Solo'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Lando Calrissian'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Chewbacca'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Han Solo.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Lando Calrissian.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Chewbacca.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Outer Rim Smuggler'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Concussion Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Assault Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Elusiveness'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Draw Their Fire'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Veteran Instincts'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Luke Skywalker'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Nien Nunb'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Chewbacca'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Weapons Engineer'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Shield Upgrade'
            type: 'modification'
            count: 2
        }
        {
            name: 'Engine Upgrade'
            type: 'modification'
            count: 2
        }
        {
            name: 'Millennium Falcon'
            type: 'title'
            count: 1
        }
    ]
    'TIE Interceptor Expansion Pack': [
        {
            name: 'TIE Interceptor'
            type: 'ship'
            count: 1
        }
        {
            name: 'Soontir Fel'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Turr Phennir'
            type: 'pilot'
            count: 1
        }
        {
            name: '''"Fel's Wrath"'''
            type: 'pilot'
            count: 1
        }
        {
            name: 'Soontir Fel'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Turr Phennir'
            type: 'upgrade'
            count: 1
        }
        {
            name: '''"Fel's Wrath"'''
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Saber Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Avenger Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Alpha Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Daredevil'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Elusiveness'
            type: 'upgrade'
            count: 1
        }
    ]
    'Slave I Expansion Pack': [
        {
            name: 'Firespray-31'
            type: 'ship'
            count: 1
        }
        {
            name: 'Boba Fett'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Kath Scarlet'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Krassis Trelix'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Boba Fett.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Kath Scarlet'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Krassis Trelix'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Bounty Hunter'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Homing Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Assault Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ion Cannon'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Heavy Laser Cannon'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Veteran Instincts'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Expose'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Seismic Charges'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Proximity Mines'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Gunner'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Mercenary Copilot'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Stealth Device'
            type: 'modification'
            count: 2
        }
        {
            name: 'Slave I'
            type: 'title'
            count: 1
        }
    ]
    'B-Wing Expansion Pack': [
        {
            name: 'B-Wing'
            type: 'ship'
            count: 1
        }
        {
            name: 'Ten Numb'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Ibtisam'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Ten Numb'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ibtisam'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Dagger Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Blue Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Fire-Control System'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Advanced Proton Torpedoes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Proton Torpedoes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ion Cannon'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Autoblaster'
            type: 'upgrade'
            count: 1
        }
    ]
    "HWK-290 Expansion Pack": [
        {
            name: 'HWK-290'
            type: 'ship'
            count: 1
        }
        {
            name: 'Jan Ors'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Kyle Katarn'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Roark Garnet'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Jan Ors.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Kyle Katarn.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Roark Garnet'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Rebel Operative'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Ion Cannon Turret'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Recon Specialist'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Moldy Crow'
            type: 'title'
            count: 1
        }
        {
            name: 'Blaster Turret'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Saboteur'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Intelligence Agent'
            type: 'upgrade'
            count: 1
        }
    ]
    "TIE Bomber Expansion Pack": [
        {
            name: 'TIE Bomber'
            type: 'ship'
            count: 1
        }
        {
            name: 'Major Rhymer'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Captain Jonus'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Major Rhymer'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Captain Jonus'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Gamma Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Scimitar Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Proton Bombs'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Assault Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Advanced Proton Torpedoes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Seismic Charges'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Adrenaline Rush'
            type: 'upgrade'
            count: 1
        }
    ]
    "Lambda-Class Shuttle Expansion Pack": [
        {
            name: 'Lambda-Class Shuttle'
            type: 'ship'
            count: 1
        }
        {
            name: 'Captain Kagi'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Colonel Jendon'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Captain Yorr'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Captain Kagi'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Colonel Jendon'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Captain Yorr'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Omicron Group Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Sensor Jammer'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Rebel Captive'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Advanced Sensors'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'ST-321'
            type: 'title'
            count: 1
        }
        {
            name: 'Heavy Laser Cannon'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Weapons Engineer'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Darth Vader'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Intelligence Agent'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Navigator'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Flight Instructor'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Anti-Pursuit Lasers'
            type: 'modification'
            count: 2
        }
    ]
    "Z-95 Headhunter Expansion Pack": [
        {
            name: 'Z-95 Headhunter'
            type: 'ship'
            count: 1
        }
        {
            name: 'Airen Cracken'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Lieutenant Blount'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Airen Cracken'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Lieutenant Blount'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Tala Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Bandit Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Munitions Failsafe'
            type: 'modification'
            count: 1
        }
        {
            name: 'Decoy'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Wingman'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ion Pulse Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Assault Missiles'
            type: 'upgrade'
            count: 1
        }
    ]
    'E-Wing Expansion Pack': [
        {
            name: 'E-Wing'
            type: 'ship'
            count: 1
        }
        {
            name: 'Corran Horn'
            type: 'pilot'
            count: 1
        }
        {
            name: "Etahn A'baht"
            type: 'pilot'
            count: 1
        }
        {
            name: 'Corran Horn'
            type: 'upgrade'
            count: 1
        }
        {
            name: "Etahn A'baht"
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Blackmoon Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Knave Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Advanced Sensors'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Outmaneuver'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R7-T1'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R7 Astromech'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Flechette Torpedoes'
            type: 'upgrade'
            count: 1
        }
    ]
    'TIE Defender Expansion Pack': [
        {
            name: 'TIE Defender'
            type: 'ship'
            count: 1
        }
        {
            name: 'Rexler Brath'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Colonel Vessery'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Rexler Brath'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Colonel Vessery'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Onyx Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Delta Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Munitions Failsafe'
            type: 'modification'
            count: 1
        }
        {
            name: 'Predator'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Outmaneuver'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ion Cannon'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ion Pulse Missiles'
            type: 'upgrade'
            count: 1
        }
    ]
    'TIE Phantom Expansion Pack': [
        {
            name: 'TIE Phantom'
            type: 'ship'
            count: 1
        }
        {
            name: '"Whisper"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Echo"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Whisper"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Echo"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Shadow Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Sigma Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Fire-Control System'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Tactician'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Recon Specialist'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Advanced Cloaking Device'
            type: 'modification'
            count: 1
        }
        {
            name: 'Stygium Particle Accelerator'
            type: 'modification'
            count: 1
        }
    ]
    'YT-2400 Freighter Expansion Pack': [
        {
            name: 'YT-2400'
            type: 'ship'
            count: 1
        }
        {
            name: 'Dash Rendar'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Eaden Vrill'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Leebo"'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Dash Rendar.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Eaden Vrill'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Leebo".'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Wild Space Fringer'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Experimental Interface'
            type: 'modification'
            count: 1
        }
        {
            name: 'Countermeasures'
            type: 'modification'
            count: 2
        }
        {
            name: 'Outrider'
            type: 'title'
            count: 1
        }
        {
            name: 'Lone Wolf'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Leebo"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Lando Calrissian'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Stay On Target'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Dash Rendar'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Gunner'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Mercenary Copilot'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Proton Rockets'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Heavy Laser Cannon'
            type: 'upgrade'
            count: 1
        }
    ]
    "VT-49 Decimator Expansion Pack": [
        {
            name: 'VT-49 Decimator'
            type: 'ship'
            count: 1
        }
        {
            name: 'Captain Oicunn'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Rear Admiral Chiraneau'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Commander Kenkirk'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Captain Oicunn'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Rear Admiral Chiraneau'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Commander Kenkirk'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Patrol Leader'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Ruthlessness'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Dauntless'
            type: 'title'
            count: 1
        }
        {
            name: 'Ysanne Isard'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Moff Jerjerrod'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Intimidation'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Tactical Jammer'
            type: 'modification'
            count: 2
        }
        {
            name: 'Proton Bombs'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Mara Jade'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Fleet Officer'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ion Torpedoes'
            type: 'upgrade'
            count: 2
        }
    ]
    'Imperial Aces Expansion Pack': [
        {
            name: 'TIE Interceptor'
            type: 'ship'
            count: 2
        }
        {
            name: 'Carnor Jax'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Kir Kanos'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Royal Guard Pilot'
            type: 'pilot'
            count: 2
        }
        {
            name: 'Tetran Cowall'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Lieutenant Lorrir'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Carnor Jax'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Kir Kanos'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Tetran Cowall'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Lieutenant Lorrir'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Saber Squadron Pilot'
            type: 'pilot'
            count: 2
        }
        {
            name: 'Royal Guard TIE'
            type: 'title'
            count: 2
        }
        {
            name: 'Targeting Computer'
            type: 'modification'
            count: 2
        }
        {
            name: 'Hull Upgrade'
            type: 'modification'
            count: 2
        }
        {
            name: 'Push the Limit'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Opportunist'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Shield Upgrade'
            type: 'modification'
            count: 2
        }
    ]
    'Rebel Aces Expansion Pack': [
        {
            name: 'A-Wing'
            type: 'ship'
            count: 1
        }
        {
            name: 'B-Wing'
            type: 'ship'
            count: 1
        }
        {
            name: 'Jake Farrell'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Gemmer Sojan'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Jake Farrell'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Gemmer Sojan'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Green Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Prototype Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Keyan Farlander'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Nera Dantels'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Keyan Farlander'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Nera Dantels'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Dagger Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Blue Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Chardaan Refit'
            type: 'upgrade'
            count: 3
        }
        {
            name: 'A-Wing Test Pilot'
            type: 'title'
            count: 2
        }
        {
            name: 'Enhanced Scopes'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Proton Rockets'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'B-Wing/E2'
            type: 'modification'
            count: 2
        }
        {
            name: 'Kyle Katarn'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Jan Ors'
            type: 'upgrade'
            count: 1
        }
    ]
    'Rebel Transport Expansion Pack': [
        {
            name: 'X-Wing'
            type: 'ship'
            count: 1
        }
        {
            name: 'GR-75 Medium Transport'
            type: 'ship'
            count: 1
        }
        {
            name: 'GR-75 Medium Transport'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Wes Janson'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Jek Porkins'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Hobbie" Klivian'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Tarn Mison'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Wes Janson'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Jek Porkins'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Hobbie" Klivian'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Tarn Mison'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Red Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Rookie Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Dutyfree'
            type: 'title'
            count: 1
        }
        {
            name: 'Quantum Storm'
            type: 'title'
            count: 1
        }
        {
            name: 'Bright Hope'
            type: 'title'
            count: 1
        }
        {
            name: 'Expanded Cargo Hold'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R2-D6'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R4-D6'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Flechette Torpedoes'
            type: 'upgrade'
            count: 3
        }
        {
            name: 'R3-A2'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'WED-15 Repair Droid'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Backup Shield Generator'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Carlist Rieekan'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'EM Emitter'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Engine Booster'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R5-P9'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Comms Booster'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Frequency Jammer'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Shield Projector'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Tibanna Gas Supplies'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Jan Dodonna'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Toryn Farr'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Slicer Tools'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Combat Retrofit'
            type: 'modification'
            count: 1
        }
    ]
    'Tantive IV Expansion Pack': [
        {
            name: 'CR90 Corvette (Fore)'
            type: 'ship'
            count: 1
        }
        {
            name: 'CR90 Corvette (Aft)'
            type: 'ship'
            count: 1
        }
        {
            name: 'CR90 Corvette (Fore)'
            type: 'pilot'
            count: 1
        }
        # {
        #     name: 'CR90 Corvette (Crippled Fore)'
        #     type: 'pilot'
        #     count: 1
        # }
        {
            name: 'CR90 Corvette (Aft)'
            type: 'pilot'
            count: 1
        }
        # {
        #     name: 'CR90 Corvette (Crippled Aft)'
        #     type: 'pilot'
        #     count: 1
        # }
        {
            name: "Jaina's Light"
            type: 'title'
            count: 1
        }
        {
            name: "Dodonna's Pride"
            type: 'title'
            count: 1
        }
        {
            name: 'Tantive IV'
            type: 'title'
            count: 1
        }
        {
            name: 'Backup Shield Generator'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Han Solo'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'C-3PO'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Engine Booster'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Comms Booster'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Engineering Team'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Gunnery Team'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ionization Reactor'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Leia Organa'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R2-D2 (Crew)'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Sensor Team'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Targeting Coordinator'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Tibanna Gas Supplies'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Raymus Antilles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Quad Laser Cannons'
            type: 'upgrade'
            count: 3
        }
        {
            name: 'Single Turbolasers'
            type: 'upgrade'
            count: 3
        }
    ]
    'StarViper Expansion Pack': [
        {
            name: 'StarViper'
            type: 'ship'
            count: 1
        }
        {
            name: 'Prince Xizor'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Guri'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Prince Xizor'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Guri'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Black Sun Vigo'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Black Sun Enforcer'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Virago'
            type: 'title'
            count: 1
        }
        {
            name: 'Bodyguard'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Accuracy Corrector'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Inertial Dampeners'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Autothrusters'
            type: 'modification'
            count: 2
        }
        {
            name: 'Calculation'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ion Torpedoes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Hull Upgrade'
            type: 'modification'
            count: 1
        }
    ]
    "M3-A Interceptor Expansion Pack": [
        {
            name: 'M3-A Interceptor'
            type: 'ship'
            count: 1
        }
        {
            name: 'Serissu'
            type: 'pilot'
            count: 1
        }
        {
            name: "Laetin A'shera"
            type: 'pilot'
            count: 1
        }
        {
            name: 'Serissu'
            type: 'upgrade'
            count: 1
        }
        {
            name: "Laetin A'shera"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Tansarii Point Veteran"
            type: 'pilot'
            count: 1
        }
        {
            name: "Cartel Spacer"
            type: 'pilot'
            count: 1
        }
        {
            name: '"Heavy Scyk" Interceptor'
            type: 'title'
            count: 1
            skipForSource: true # special :(
        }
        {
            name: '"Heavy Scyk" Interceptor (Cannon)'
            type: 'title'
            count: 0 # special :(
        }
        {
            name: '"Heavy Scyk" Interceptor (Missile)'
            type: 'title'
            count: 0 # special :(
        }
        {
            name: '"Heavy Scyk" Interceptor (Torpedo)'
            type: 'title'
            count: 0 # special :(
        }
        {
            name: 'Flechette Cannon'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ion Cannon'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Mangler" Cannon'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Stealth Device'
            type: 'modification'
            count: 1
        }
    ]
    "IG-2000 Expansion Pack": [
        {
            name: 'Aggressor'
            type: 'ship'
            count: 1
        }
        {
            name: 'IG-88A'
            type: 'pilot'
            count: 1
        }
        {
            name: 'IG-88B'
            type: 'pilot'
            count: 1
        }
        {
            name: 'IG-88C'
            type: 'pilot'
            count: 1
        }
        {
            name: 'IG-88D'
            type: 'pilot'
            count: 1
        }
        {
            name: 'IG-88A'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'IG-88B'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'IG-88C'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'IG-88D.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'IG-2000'
            type: 'title'
            count: 1
        }
        {
            name: 'Accuracy Corrector'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Autoblaster'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Mangler" Cannon'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Proximity Mines'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Seismic Charges'
            type: 'upgrade'
            count: 1
        }
        {
            name: "Dead Man's Switch"
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Feedback Array'
            type: 'upgrade'
            count: 2
        }
        {
            name: '"Hot Shot" Blaster'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Inertial Dampeners'
            type: 'upgrade'
            count: 1
        }
    ]
    "Most Wanted Expansion Pack": [
        {
            name: 'Z-95 Headhunter'
            type: 'ship'
            count: 2
        }
        {
            name: 'Y-Wing'
            type: 'ship'
            count: 1
        }
        {
            name: "N'Dru Suhlak"
            type: 'pilot'
            count: 1
        }
        {
            name: "Kaa'to Leeachos"
            type: 'pilot'
            count: 1
        }
        {
            name: "N'Dru Suhlak"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Kaa'to Leeachos"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Black Sun Soldier"
            type: 'pilot'
            count: 2
        }
        {
            name: "Binayre Pirate"
            type: 'pilot'
            count: 2
        }
        {
            name: "Kavil"
            type: 'pilot'
            count: 1
        }
        {
            name: "Drea Renthal"
            type: 'pilot'
            count: 1
        }
        {
            name: "Kavil"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Drea Renthal"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Hired Gun"
            type: 'pilot'
            count: 2
        }
        {
            name: "Syndicate Thug"
            type: 'pilot'
            count: 2
        }
        {
            name: "Boba Fett (Scum)"
            type: 'pilot'
            count: 1
        }
        {
            name: "Kath Scarlet (Scum)"
            type: 'pilot'
            count: 1
        }
        {
            name: "Emon Azzameen"
            type: 'pilot'
            count: 1
        }
        {
            name: "Boba Fett (Scum)."
            type: 'upgrade'
            count: 1
        }
        {
            name: "Kath Scarlet (Scum)"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Emon Azzameen"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Mandalorian Mercenary"
            type: 'pilot'
            count: 1
        }
        {
            name: "Dace Bonearm"
            type: 'pilot'
            count: 1
        }
        {
            name: "Palob Godalhi"
            type: 'pilot'
            count: 1
        }
        {
            name: "Torkil Mux"
            type: 'pilot'
            count: 1
        }
        {
            name: "Dace Bonearm"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Palob Godalhi"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Torkil Mux"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Spice Runner"
            type: 'pilot'
            count: 1
        }
        {
            name: "Greedo"
            type: 'upgrade'
            count: 1
        }
        {
            name: "K4 Security Droid"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Outlaw Tech"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Autoblaster Turret"
            type: 'upgrade'
            count: 2
        }
        {
            name: "Bomb Loadout"
            type: 'upgrade'
            count: 2
        }
        {
            name: "R4-B11"
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Genius"'
            type: 'upgrade'
            count: 1
        }
        {
            name: "R4 Agromech"
            type: 'upgrade'
            count: 2
        }
        {
            name: "Salvaged Astromech"
            type: 'upgrade'
            count: 2
        }
        {
            name: "Unhinged Astromech"
            type: 'upgrade'
            count: 2
        }
        {
            name: "BTL-A4 Y-Wing"
            type: 'title'
            count: 2
        }
        {
            name: "Andrasta"
            type: 'title'
            count: 1
        }
        {
            name: '"Hot Shot" Blaster'
            type: 'upgrade'
            count: 1
        }
    ]
    "Hound's Tooth Expansion Pack": [
        {
            name: 'YV-666'
            type: 'ship'
            count: 1
        }
        {
            name: 'Bossk'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Moralo Eval'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Latts Razzi'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Bossk.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Moralo Eval'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Latts Razzi.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Trandoshan Slaver'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Lone Wolf'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Crack Shot'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Stay On Target'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Heavy Laser Cannon'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Bossk'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'K4 Security Droid'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Outlaw Tech'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Glitterstim'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Engine Upgrade'
            type: 'modification'
            count: 1
        }
        {
            name: 'Ion Projector'
            type: 'modification'
            count: 2
        }
        {
            name: 'Maneuvering Fins'
            type: 'modification'
            count: 1
        }
        {
            name: "Hound's Tooth"
            type: 'title'
            count: 1
        }
    ]
    'Kihraxz Fighter Expansion Pack': [
        {
            name: 'Kihraxz Fighter'
            type: 'ship'
            count: 1
        }
        {
            name: 'Talonbane Cobra'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Graz the Hunter'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Talonbane Cobra'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Graz the Hunter'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Black Sun Ace'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Cartel Marauder'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Crack Shot'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Lightning Reflexes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Predator'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Homing Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Glitterstim'
            type: 'upgrade'
            count: 1
        }
    ]
    'K-Wing Expansion Pack': [
        {
            name: 'K-Wing'
            type: 'ship'
            count: 1
        }
        {
            name: 'Miranda Doni'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Esege Tuketu'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Miranda Doni'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Esege Tuketu'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Guardian Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Warden Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Twin Laser Turret'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Plasma Torpedoes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Advanced Homing Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Bombardier'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Conner Net'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Extra Munitions'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ion Bombs'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Advanced SLAM'
            type: 'modification'
            count: 1
        }
    ]
    'TIE Punisher Expansion Pack': [
        {
            name: 'TIE Punisher'
            type: 'ship'
            count: 1
        }
        {
            name: '"Redline"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Deathrain"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Redline"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Deathrain"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Black Eight Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Cutlass Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Enhanced Scopes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Extra Munitions'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Flechette Torpedoes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Plasma Torpedoes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Advanced Homing Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Cluster Mines'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ion Bombs'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Twin Ion Engine Mk. II'
            type: 'modification'
            count: 2
        }
    ]
    "Imperial Raider Expansion Pack": [
        {
            name: "Raider-class Corvette (Fore)"
            type: 'ship'
            count: 1
        }
        {
            name: "Raider-class Corvette (Aft)"
            type: 'ship'
            count: 1
        }
        {
            name: "TIE Advanced"
            type: 'ship'
            count: 1
        }
        {
            name: "Raider-class Corvette (Fore)"
            type: 'pilot'
            count: 1
        }
        {
            name: "Raider-class Corvette (Aft)"
            type: 'pilot'
            count: 1
        }
        {
            name: "Juno Eclipse"
            type: 'pilot'
            count: 1
        }
        {
            name: "Zertik Strom"
            type: 'pilot'
            count: 1
        }
        {
            name: "Commander Alozen"
            type: 'pilot'
            count: 1
        }
        {
            name: "Lieutenant Colzet"
            type: 'pilot'
            count: 1
        }
        {
            name: "Juno Eclipse"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Zertik Strom"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Commander Alozen"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Lieutenant Colzet"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Storm Squadron Pilot"
            type: 'pilot'
            count: 1
        }
        {
            name: "Tempest Squadron Pilot"
            type: 'pilot'
            count: 1
        }
        {
            name: "Advanced Targeting Computer"
            type: 'upgrade'
            count: 4
        }
        {
            name: "TIE/x1"
            type: 'title'
            count: 4
        }
        {
            name: "Cluster Missiles"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Proton Rockets"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Captain Needa"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Grand Moff Tarkin"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Emperor Palpatine"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Admiral Ozzel"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Shield Technician"
            type: 'upgrade'
            count: 2
        }
        {
            name: "Gunnery Team"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Engineering Team"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Sensor Team"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Single Turbolasers"
            type: 'upgrade'
            count: 2
        }
        {
            name: "Ion Cannon Battery"
            type: 'upgrade'
            count: 4
        }
        {
            name: "Quad Laser Cannons"
            type: 'upgrade'
            count: 2
        }
        {
            name: "Tibanna Gas Supplies"
            type: 'upgrade'
            count: 2
        }
        {
            name: "Engine Booster"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Backup Shield Generator"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Comms Booster"
            type: 'upgrade'
            count: 1
        }
        {
            name: "Assailer"
            type: 'title'
            count: 1
        }
        {
            name: "Instigator"
            type: 'title'
            count: 1
        }
        {
            name: "Impetuous"
            type: 'title'
            count: 1
        }
    ]
    'The Force Awakens Core Set': [
        {
            name: 'T-70 X-Wing'
            type: 'ship'
            count: 1
        }
        {
            name: 'TIE/fo Fighter'
            type: 'ship'
            count: 2
        }
        {
            name: 'Poe Dameron'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Blue Ace"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Blue Ace"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Red Squadron Veteran'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Blue Squadron Novice'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Omega Ace"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Epsilon Leader"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Zeta Ace"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Omega Ace"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Epsilon Leader"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Zeta Ace"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Omega Squadron Pilot'
            type: 'pilot'
            count: 2
        }
        {
            name: 'Zeta Squadron Pilot'
            type: 'pilot'
            count: 2
        }
        {
            name: 'Epsilon Squadron Pilot'
            type: 'pilot'
            count: 2
        }
        {
            name: 'Wired'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'BB-8'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R5-X3'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Proton Torpedoes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Weapons Guidance'
            type: 'upgrade'
            count: 1
        }
    ]
    'Imperial Assault Carrier Expansion Pack': [
        {
            name: 'TIE Fighter'
            type: 'ship'
            count: 2
        }
        {
            name: 'Gozanti-class Cruiser'
            type: 'ship'
            count: 1
        }
        {
            name: 'Gozanti-class Cruiser'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Scourge"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Wampa"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Youngster"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Chaser"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Scourge"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Wampa"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Youngster"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Chaser"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Academy Pilot'
            type: 'pilot'
            count: 2
        }
        {
            name: 'Black Squadron Pilot'
            type: 'pilot'
            count: 2
        }
        {
            name: 'Obsidian Squadron Pilot'
            type: 'pilot'
            count: 2
        }
        {
            name: 'Marksmanship'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Expert Handling'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Expose'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ion Torpedoes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Cluster Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Homing Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Dual Laser Turret'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Broadcast Array'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Construction Droid'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Agent Kallus'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Rear Admiral Chiraneau'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ordnance Experts'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Docking Clamps'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Cluster Bombs'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Automated Protocols'
            type: 'modification'
            count: 3
        }
        {
            name: 'Optimized Generators'
            type: 'modification'
            count: 3
        }
        {
            name: 'Ordnance Tubes'
            type: 'modification'
            count: 2
        }
        {
            name: 'Requiem'
            type: 'title'
            count: 1
        }
        {
            name: 'Vector'
            type: 'title'
            count: 1
        }
        {
            name: 'Suppressor'
            type: 'title'
            count: 1
        }
    ]
    'T-70 X-Wing Expansion Pack': [
        {
            name: 'T-70 X-Wing'
            type: 'ship'
            count: 1
        }
        {
            name: 'Ello Asty'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Red Ace"'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Ello Asty'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Red Ace"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Red Squadron Veteran'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Blue Squadron Novice'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Cool Hand'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Targeting Astromech'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Weapons Guidance'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Integrated Astromech'
            type: 'modification'
            count: 1
        }
        {
            name: 'Advanced Proton Torpedoes'
            type: 'upgrade'
            count: 1
        }
    ]
    'TIE/fo Fighter Expansion Pack': [
        {
            name: 'TIE/fo Fighter'
            type: 'ship'
            count: 1
        }
        {
            name: '"Omega Leader"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Zeta Leader"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Epsilon Ace"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Omega Leader"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Zeta Leader"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Epsilon Ace"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Omega Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Zeta Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Epsilon Squadron Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Juke'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Comm Relay'
            type: 'upgrade'
            count: 1
        }
    ]
    'Ghost Expansion Pack': [
        {
            name: 'VCX-100'
            type: 'ship'
            count: 1
        }
        {
            name: 'Attack Shuttle'
            type: 'ship'
            count: 1
        }
        {
            name: 'Hera Syndulla'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Kanan Jarrus'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Chopper"'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Hera Syndulla.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Kanan Jarrus.'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Chopper".'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Lothal Rebel'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Hera Syndulla (Attack Shuttle)'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Sabine Wren'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Ezra Bridger'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Zeb" Orrelios'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Sabine Wren.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ezra Bridger.'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Zeb" Orrelios.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Predator'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Reinforced Deflectors'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Dorsal Turret'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Advanced Proton Torpedoes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Hera Syndulla'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Zeb" Orrelios'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Kanan Jarrus'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ezra Bridger'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Sabine Wren'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Chopper"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Conner Net'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Cluster Mines'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Thermal Detonators'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ghost'
            type: 'title'
            count: 1
        }
        {
            name: 'Phantom'
            type: 'title'
            count: 1
        }
    ]
    'Punishing One Expansion Pack': [
        {
            name: 'JumpMaster 5000'
            type: 'ship'
            count: 1
        }
        {
            name: 'Dengar'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Tel Trevura'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Manaroo'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Dengar.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Tel Trevura'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Manaroo'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Contracted Scout'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Rage'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Attanni Mindlink'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Plasma Torpedoes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Dengar'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Boba Fett'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Gonk"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R5-P8'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Overclocked R4'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Feedback Array'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Punishing One'
            type: 'title'
            count: 1
        }
        {
            name: 'Guidance Chips'
            type: 'modification'
            count: 2
        }
    ]
    'Mist Hunter Expansion Pack': [
        {
            name: 'G-1A Starfighter'
            type: 'ship'
            count: 1
        }
        {
            name: 'Zuckuss'
            type: 'pilot'
            count: 1
        }
        {
            name: '4-LOM'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Zuckuss.'
            type: 'upgrade'
            count: 1
        }
        {
            name: '4-LOM.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Gand Findsman'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Ruthless Freelancer'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Adaptability'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Tractor Beam'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Electronic Baffle'
            type: 'upgrade'
            count: 2
        }
        {
            name: '4-LOM'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Zuckuss'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Cloaking Device'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Mist Hunter'
            type: 'title'
            count: 1
        }
    ]
    "Inquisitor's TIE Expansion Pack": [
        {
            name: 'TIE Advanced Prototype'
            type: 'ship'
            count: 1
        }
        {
            name: 'The Inquisitor'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Valen Rudor'
            type: 'pilot'
            count: 1
        }
        {
            name: 'The Inquisitor'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Valen Rudor'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Baron of the Empire'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Sienar Test Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Deadeye'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Homing Missiles'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'XX-23 S-Thread Tracers'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Guidance Chips'
            type: 'modification'
            count: 1
        }
        {
            name: 'TIE/v1'
            type: 'title'
            count: 1
        }
    ]
    "Imperial Veterans Expansion Pack": [
        {
            name: 'TIE Bomber'
            type: 'ship'
            count: 1
        }
        {
            name: 'TIE Defender'
            type: 'ship'
            count: 1
        }
        {
            name: 'Tomax Bren'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Deathfire"'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Tomax Bren'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Deathfire"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Gamma Squadron Veteran'
            type: 'pilot'
            count: 2
        }
        {
            name: 'Maarek Stele (TIE Defender)'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Countess Ryad'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Maarek Stele (TIE Defender)'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Countess Ryad'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Glaive Squadron Pilot'
            type: 'pilot'
            count: 2
        }
        {
            name: 'Crack Shot'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Tractor Beam'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Systems Officer'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Cluster Mines'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Proximity Mines'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Long-Range Scanners'
            type: 'modification'
            count: 2
        }
        {
            name: 'TIE/x7'
            type: 'title'
            count: 2
        }
        {
            name: 'TIE/D'
            type: 'title'
            count: 2
        }
        {
            name: 'TIE Shuttle'
            type: 'title'
            count: 2
        }
    ]
    'ARC-170 Expansion Pack': [
        {
            name: 'ARC-170'
            type: 'ship'
            count: 1
        }
        {
            name: 'Norra Wexley'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Shara Bey'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Thane Kyrell'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Braylen Stramm'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Norra Wexley'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Shara Bey'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Thane Kyrell'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Braylen Stramm'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Adrenaline Rush'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Recon Specialist'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Tail Gunner'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R3 Astromech'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Seismic Torpedo'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Vectored Thrusters'
            type: 'modification'
            count: 2
        }
        {
            name: 'Alliance Overhaul'
            type: 'title'
            count: 1
        }
    ]
    'Special Forces TIE Expansion Pack': [
        {
            name: 'TIE/sf Fighter'
            type: 'ship'
            count: 1
        }
        {
            name: '"Quickdraw"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Backdraft"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Quickdraw"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Backdraft"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Omega Specialist'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Zeta Specialist'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Wired'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Collision Detector'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Sensor Cluster'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Special Ops Training'
            type: 'title'
            count: 1
        }
    ]
    'Protectorate Starfighter Expansion Pack': [
        {
            name: 'Protectorate Starfighter'
            type: 'ship'
            count: 1
        }
        {
            name: 'Fenn Rau'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Old Teroch'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Kad Solus'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Fenn Rau'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Old Teroch'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Kad Solus'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Concord Dawn Ace'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Concord Dawn Veteran'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Zealous Recruit'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Fearlessness'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Concord Dawn Protector'
            type: 'title'
            count: 1
        }
    ]
    'Shadow Caster Expansion Pack': [
        {
            name: 'Lancer-class Pursuit Craft'
            type: 'ship'
            count: 1
        }
        {
            name: 'Ketsu Onyo'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Asajj Ventress'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Sabine Wren (Scum)'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Ketsu Onyo.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Asajj Ventress'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Sabine Wren (Scum)'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Shadowport Hunter'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Veteran Instincts'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'IG-88D'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Ketsu Onyo'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Latts Razzi'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Black Market Slicer Tools'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Rigged Cargo Chute'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Countermeasures'
            type: 'modification'
            count: 1
        }
        {
            name: 'Gyroscopic Targeting'
            type: 'modification'
            count: 1
        }
        {
            name: 'Tactical Jammer'
            type: 'modification'
            count: 2
        }
        {
            name: 'Shadow Caster'
            type: 'title'
            count: 1
        }
    ]
    'Heroes of the Resistance Expansion Pack': [
        {
            name: 'YT-1300'
            type: 'ship'
            count: 1
        }
        {
            name: 'T-70 X-Wing'
            type: 'ship'
            count: 1
        }
        {
            name: 'Han Solo (TFA)'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Rey'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Chewbacca (TFA)'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Han Solo (TFA)'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Rey.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Chewbacca (TFA)'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Resistance Sympathizer'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Poe Dameron (PS9)'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Nien Nunb'
            type: 'pilot'
            count: 1
        }
        {
            name: '''"Snap" Wexley'''
            type: 'pilot'
            count: 1
        }
        {
            name: 'Jess Pava'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Poe Dameron (PS9)'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Nien Nunb'
            type: 'upgrade'
            count: 1
        }
        {
            name: '''"Snap" Wexley'''
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Jess Pava'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Red Squadron Veteran'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Blue Squadron Novice'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Snap Shot'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Trick Shot'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Finn'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Hotshot Co-pilot'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Rey'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'M9-G8'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Burnout SLAM'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Primed Thrusters'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Pattern Analyzer'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Millennium Falcon (TFA)'
            type: 'title'
            count: 1
        }
        {
            name: 'Black One'
            type: 'title'
            count: 1
        }
        {
            name: 'Integrated Astromech'
            type: 'modification'
            count: 2
        }
        {
            name: 'Smuggling Compartment'
            type: 'modification'
            count: 1
        }
    ]
    "U-Wing Expansion Pack": [
        {
            name: 'U-Wing'
            type: 'ship'
            count: 1
        }
        {
            name: 'Cassian Andor'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Bodhi Rook'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Heff Tobber'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Cassian Andor.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Bodhi Rook.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Heff Tobber'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Blue Squadron Pathfinder'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Inspiring Recruit'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Cassian Andor'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Bistan'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Jyn Erso'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Baze Malbus'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Bodhi Rook'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Expertise'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Pivot Wing'
            type: 'title'
            count: 1
        }
        {
            name: 'Stealth Device'
            type: 'modification'
            count: 2
        }
        {
            name: 'Sensor Jammer'
            type: 'upgrade'
            count: 1
        }
    ]
    "TIE Striker Expansion Pack": [
        {
            name: 'TIE Striker'
            type: 'ship'
            count: 1
        }
        {
            name: '"Duchess"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Pure Sabacc"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Countdown"'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Duchess"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Pure Sabacc"'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Countdown"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Black Squadron Scout'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Scarif Defender'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Imperial Trainee'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Swarm Leader'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Lightweight Frame'
            type: 'modification'
            count: 1
        }
        {
            name: 'Adaptive Ailerons'
            type: 'title'
            count: 1
        }
    ]
    "Sabine's TIE Fighter Expansion Pack": [
        {
            name: 'TIE Fighter'
            type: 'ship'
            count: 1
        }
        {
            name: 'Ahsoka Tano'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Sabine Wren (TIE Fighter)'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Captain Rex'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Ahsoka Tano'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Captain Rex.'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Zeb" Orrelios (TIE Fighter)'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Veteran Instincts'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Captain Rex'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'EMP Device'
            type: 'upgrade'
            count: 1
        }
        {
            name: '''Sabine's Masterpiece'''
            type: 'title'
            count: 1
        }
        {
            name: 'Captured TIE'
            type: 'modification'
            count: 1
        }
    ]
    "Upsilon-class Shuttle Expansion Pack": [
        {
            name: 'Upsilon-class Shuttle'
            type: 'ship'
            count: 1
        }
        {
            name: 'Kylo Ren'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Major Stridan'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Lieutenant Dormitz'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Kylo Ren.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Major Stridan'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Lieutenant Dormitz'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Starkiller Base Pilot'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Snap Shot'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Kylo Ren'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'General Hux'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Operations Specialist'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Targeting Synchronizer'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Hyperwave Comm Scanner'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Ion Projector'
            type: 'modification'
            count: 2
        }
        {
            name: '''Kylo Ren's Shuttle'''
            type: 'title'
            count: 1
        }
    ]
    "Quadjumper Expansion Pack": [
        {
            name: 'Quadjumper'
            type: 'ship'
            count: 1
        }
        {
            name: 'Constable Zuvio'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Sarco Plank'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Unkar Plutt'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Constable Zuvio'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Sarco Plank'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Unkar Plutt.'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Jakku Gunrunner'
            type: 'pilot'
            count: 1
        }
        {
            name: 'A Score to Settle'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Unkar Plutt'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'BoShek'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Thermal Detonators'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Hyperwave Comm Scanner'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Scavenger Crane'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Spacetug Tractor Array'
            type: 'modification'
            count: 1
        }
    ]
    'C-ROC Cruiser Expansion Pack': [
        {
            name: 'C-ROC Cruiser'
            type: 'ship'
            count: 1
        }
        {
            name: 'M3-A Interceptor'
            type: 'ship'
            count: 1
        }
        {
            name: 'C-ROC Cruiser'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Genesis Red'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Quinn Jast'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Inaldra'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Sunny Bounder'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Genesis Red'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Quinn Jast'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Inaldra'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Sunny Bounder'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Tansarii Point Veteran'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Cartel Spacer'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Azmorigan'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Cikatro Vizago'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Jabba the Hutt'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'IG-RM Thug Droids'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'ARC Caster'
            type: 'upgrade'
            count: 5
        }
        {
            name: 'Heavy Laser Turret'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Supercharged Power Cells'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Quick-release Cargo Locks'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Merchant One'
            type: 'title'
            count: 1
        }
        {
            name: 'Broken Horn'
            type: 'title'
            count: 1
        }
        {
            name: 'Insatiable Worrt'
            type: 'title'
            count: 1
        }
        {
            name: '"Light Scyk" Interceptor'
            type: 'title'
            count: 6
        }
        {
            name: 'Automated Protocols'
            type: 'modification'
            count: 1
        }
        {
            name: 'Optimized Generators'
            type: 'modification'
            count: 1
        }
        {
            name: 'Pulsed Ray Shield'
            type: 'modification'
            count: 5
        }
    ]
    "Auzituck Gunship Expansion Pack": [
        {
            name: 'Auzituck Gunship'
            type: 'ship'
            count: 1
        }
        {
            name: 'Wullffwarro'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Lowhhrick'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Wullffwarro'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Lowhhrick'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Wookiee Liberator'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Kashyyyk Defender'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Intimidation'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Selflessness'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Wookiee Commandos'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Tactician'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Breach Specialist'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Hull Upgrade'
            type: 'modification'
            count: 1
        }
    ]
    "Scurrg H-6 Bomber Expansion Pack": [
        {
            name: 'Scurrg H-6 Bomber'
            type: 'ship'
            count: 1
        }
        {
            name: 'Captain Nym (Rebel)'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Captain Nym'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Sol Sixxa'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Captain Nym (Rebel)'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Captain Nym'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Sol Sixxa'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Lok Revenant'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Karthakk Pirate'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Lightning Reflexes'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Seismic Torpedo'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Cruise Missiles'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Bomblet Generator'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Minefield Mapper'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Synced Turret'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Cad Bane'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'R4-E1'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Havoc'
            type: 'title'
            count: 1
        }
    ]
    "TIE Aggressor Expansion Pack": [
        {
            name: 'TIE Aggressor'
            type: 'ship'
            count: 1
        }
        {
            name: 'Lieutenant Kestal'
            type: 'pilot'
            count: 1
        }
        {
            name: '"Double Edge"'
            type: 'pilot'
            count: 1
        }
        {
        
            name: 'Lieutenant Kestal'
            type: 'upgrade'
            count: 1
        }
        {
            name: '"Double Edge"'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Onyx Squadron Escort'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Sienar Specialist'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Intensity'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Unguided Rockets'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Twin Laser Turret'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Synced Turret'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Lightweight Frame'
            type: 'modification'
            count: 1
        }
    ]
    'Guns for Hire Expansion Pack': [
        {
            name: 'Kihraxz Fighter'
            type: 'ship'
            count: 1
        }
        {
            name: 'StarViper'
            type: 'ship'
            count: 1
        }
        {
            name: 'Viktor Hel'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Captain Jostero'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Viktor Hel'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Captain Jostero'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Black Sun Ace'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Cartel Marauder'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Dalan Oberos'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Thweek'
            type: 'pilot'
            count: 1
        }
        {
            name: 'Dalan Oberos'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Thweek'
            type: 'upgrade'
            count: 1
        }
        {
            name: 'Black Sun Assassin'
            type: 'pilot'
            count: 2
        }
        {
            name: 'Harpoon Missiles'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'Ion Dischargers'
            type: 'upgrade'
            count: 2
        }
        {
            name: 'StarViper Mk. II'
            type: 'title'
            count: 2
        }
        {
            name: 'Vaksai'
            type: 'title'
            count: 2
        }
        {
            name: 'Pulsed Ray Shield'
            type: 'modification'
            count: 2
        }
        {
            name: 'Stealth Device'
            type: 'modification'
            count: 1
        }
        {
            name: 'Vectored Thrusters'
            type: 'modification'
            count: 1
        }
    ]


class exportObj.Collection
    # collection = new exportObj.Collection
    #   expansions:
    #     "Core": 2
    #     "TIE Fighter Expansion Pack": 4
    #     "B-Wing Expansion Pack": 2
    #   singletons:
    #     ship:
    #       "T-70 X-Wing": 1
    #     pilot:
    #       "Academy Pilot": 16
    #     upgrade:
    #       "C-3PO": 4
    #       "Gunner": 5
    #     modification:
    #       "Engine Upgrade": 2
    #     title:
    #       "TIE/x1": 1
    #
    # # or
    #
    # collection = exportObj.Collection.load(backend)
    #
    # collection.use "pilot", "Red Squadron Pilot"
    # collection.use "upgrade", "R2-D2"
    # collection.use "upgrade", "Ion Pulse Missiles" # returns false
    #
    # collection.release "pilot", "Red Squadron Pilot"
    # collection.release "pilot", "Sigma Squadron Pilot" # returns false

    constructor: (args) ->
        @expansions = args.expansions ? {}
        @singletons = args.singletons ? {}
        # To save collection (optional)
        @backend = args.backend

        @setupUI()
        @setupHandlers()

        @reset()

        @language = 'English'

    reset: ->
        @shelf = {}
        @table = {}
        for expansion, count of @expansions
            try
                count = parseInt count
            catch
                count = 0
            for _ in [0...count]
                for card in (exportObj.manifestByExpansion[expansion] ? [])
                    for _ in [0...card.count]
                        ((@shelf[card.type] ?= {})[card.name] ?= []).push expansion

        for type, counts of @singletons
            for name, count of counts
                for _ in [0...count]
                    ((@shelf[type] ?= {})[name] ?= []).push 'singleton'

        @counts = {}
        for own type of @shelf
            for own thing of @shelf[type]
                (@counts[type] ?= {})[thing] ?= 0
                @counts[type][thing] += @shelf[type][thing].length

        component_content = $ @modal.find('.collection-inventory-content')
        component_content.text ''
        for own type, things of @counts
            contents = component_content.append $.trim """
                <div class="row-fluid">
                    <div class="span12"><h5>#{type.capitalize()}</h5></div>
                </div>
                <div class="row-fluid">
                    <ul id="counts-#{type}" class="span12"></ul>
                </div>
            """
            ul = $ contents.find("ul#counts-#{type}")
            for thing in Object.keys(things).sort(sortWithoutQuotes)
                ul.append """<li>#{thing} - #{things[thing]}</li>"""

    fixName: (name) ->
        # Special case handling for Heavy Scyk :(
        if name.indexOf('"Heavy Scyk" Interceptor') == 0
            '"Heavy Scyk" Interceptor'
        else
            name

    check: (where, type, name) ->
        (((where[type] ? {})[@fixName name] ? []).length ? 0) != 0

    checkShelf: (type, name) ->
        @check @shelf, type, name

    checkTable: (type, name) ->
        @check @table, type, name

    use: (type, name) ->
        name = @fixName name
        try
            card = @shelf[type][name].pop()
        catch e
            return false unless card?

        if card?
            ((@table[type] ?= {})[name] ?= []).push card
            true
        else
            false

    release: (type, name) ->
        name = @fixName name
        try
            card = @table[type][name].pop()
        catch e
            return false unless card?

        if card?
            ((@shelf[type] ?= {})[name] ?= []).push card
            true
        else
            false

    save: (cb=$.noop) ->
        @backend.saveCollection(this, cb) if @backend?

    @load: (backend, cb) ->
        backend.loadCollection cb

    setupUI: ->
        # Create list of released singletons
        singletonsByType = {}
        for expname, items of exportObj.manifestByExpansion
            for item in items
                (singletonsByType[item.type] ?= {})[item.name] = true
        for type, names of singletonsByType
            sorted_names = (name for name of names).sort(sortWithoutQuotes)
            singletonsByType[type] = sorted_names

        @modal = $ document.createElement 'DIV'
        @modal.addClass 'modal hide fade collection-modal hidden-print'
        $('body').append @modal
        @modal.append $.trim """
            <div class="modal-header">
                <button type="button" class="close hidden-print" data-dismiss="modal" aria-hidden="true">&times;</button>
                <h4>Your Collection</h4>
            </div>
            <div class="modal-body">
                <ul class="nav nav-tabs">
                    <li class="active"><a data-target="#collection-expansions" data-toggle="tab">Expansions</a><li>
                    <li><a data-target="#collection-ships" data-toggle="tab">Ships</a><li>
                    <li><a data-target="#collection-pilots" data-toggle="tab">Pilots</a><li>
                    <li><a data-target="#collection-upgrades" data-toggle="tab">Upgrades</a><li>
                    <li><a data-target="#collection-modifications" data-toggle="tab">Mods</a><li>
                    <li><a data-target="#collection-titles" data-toggle="tab">Titles</a><li>
                    <li><a data-target="#collection-components" data-toggle="tab">Inventory</a><li>
                </ul>
                <div class="tab-content">
                    <div id="collection-expansions" class="tab-pane active container-fluid collection-content"></div>
                    <div id="collection-ships" class="tab-pane active container-fluid collection-ship-content"></div>
                    <div id="collection-pilots" class="tab-pane active container-fluid collection-pilot-content"></div>
                    <div id="collection-upgrades" class="tab-pane active container-fluid collection-upgrade-content"></div>
                    <div id="collection-modifications" class="tab-pane active container-fluid collection-modification-content"></div>
                    <div id="collection-titles" class="tab-pane active container-fluid collection-title-content"></div>
                    <div id="collection-components" class="tab-pane container-fluid collection-inventory-content"></div>
                </div>
            </div>
            <div class="modal-footer hidden-print">
                <span class="collection-status"></span>
                &nbsp;
                <button class="btn" data-dismiss="modal" aria-hidden="true">Close</button>
            </div>
        """
        @modal_status = $ @modal.find('.collection-status')

        collection_content = $ @modal.find('.collection-content')
        for expansion in exportObj.expansions
            count = parseInt(@expansions[expansion] ? 0)
            row = $.parseHTML $.trim """
                <div class="row-fluid">
                    <div class="span12">
                        <label>
                            <input class="expansion-count" type="number" size="3" value="#{count}" />
                            <span class="expansion-name">#{expansion}</span>
                        </label>
                    </div>
                </div>
            """
            input = $ $(row).find('input')
            input.data 'expansion', expansion
            input.closest('div').css 'background-color', @countToBackgroundColor(input.val())
            $(row).find('.expansion-name').data 'english_name', expansion
            collection_content.append row

        shipcollection_content = $ @modal.find('.collection-ship-content')
        for ship in singletonsByType.ship
            count = parseInt(@singletons.ship?[ship] ? 0)
            row = $.parseHTML $.trim """
                <div class="row-fluid">
                    <div class="span12">
                        <label>
                            <input class="singleton-count" type="number" size="3" value="#{count}" />
                            <span class="ship-name">#{ship}</span>
                        </label>
                    </div>
                </div>
            """
            input = $ $(row).find('input')
            input.data 'singletonType', 'ship'
            input.data 'singletonName', ship
            input.closest('div').css 'background-color', @countToBackgroundColor(input.val())
            $(row).find('.ship-name').data 'english_name', expansion
            shipcollection_content.append row

        pilotcollection_content = $ @modal.find('.collection-pilot-content')
        for pilot in singletonsByType.pilot
            count = parseInt(@singletons.pilot?[pilot] ? 0)
            row = $.parseHTML $.trim """
                <div class="row-fluid">
                    <div class="span12">
                        <label>
                            <input class="singleton-count" type="number" size="3" value="#{count}" />
                            <span class="pilot-name">#{pilot}</span>
                        </label>
                    </div>
                </div>
            """
            input = $ $(row).find('input')
            input.data 'singletonType', 'pilot'
            input.data 'singletonName', pilot
            input.closest('div').css 'background-color', @countToBackgroundColor(input.val())
            $(row).find('.pilot-name').data 'english_name', expansion
            pilotcollection_content.append row

        upgradecollection_content = $ @modal.find('.collection-upgrade-content')
        for upgrade in singletonsByType.upgrade
            count = parseInt(@singletons.upgrade?[upgrade] ? 0)
            row = $.parseHTML $.trim """
                <div class="row-fluid">
                    <div class="span12">
                        <label>
                            <input class="singleton-count" type="number" size="3" value="#{count}" />
                            <span class="upgrade-name">#{upgrade}</span>
                        </label>
                    </div>
                </div>
            """
            input = $ $(row).find('input')
            input.data 'singletonType', 'upgrade'
            input.data 'singletonName', upgrade
            input.closest('div').css 'background-color', @countToBackgroundColor(input.val())
            $(row).find('.upgrade-name').data 'english_name', expansion
            upgradecollection_content.append row

        modificationcollection_content = $ @modal.find('.collection-modification-content')
        for modification in singletonsByType.modification
            count = parseInt(@singletons.modification?[modification] ? 0)
            row = $.parseHTML $.trim """
                <div class="row-fluid">
                    <div class="span12">
                        <label>
                            <input class="singleton-count" type="number" size="3" value="#{count}" />
                            <span class="modification-name">#{modification}</span>
                        </label>
                    </div>
                </div>
            """
            input = $ $(row).find('input')
            input.data 'singletonType', 'modification'
            input.data 'singletonName', modification
            input.closest('div').css 'background-color', @countToBackgroundColor(input.val())
            $(row).find('.modification-name').data 'english_name', expansion
            modificationcollection_content.append row

        titlecollection_content = $ @modal.find('.collection-title-content')
        for title in singletonsByType.title
            count = parseInt(@singletons.title?[title] ? 0)
            row = $.parseHTML $.trim """
                <div class="row-fluid">
                    <div class="span12">
                        <label>
                            <input class="singleton-count" type="number" size="3" value="#{count}" />
                            <span class="title-name">#{title}</span>
                        </label>
                    </div>
                </div>
            """
            input = $ $(row).find('input')
            input.data 'singletonType', 'title'
            input.data 'singletonName', title
            input.closest('div').css 'background-color', @countToBackgroundColor(input.val())
            $(row).find('.title-name').data 'english_name', expansion
            titlecollection_content.append row

    destroyUI: ->
        @modal.modal 'hide'
        @modal.remove()
        $(exportObj).trigger 'xwing-collection:destroyed', this

    setupHandlers: ->
        $(exportObj).trigger 'xwing-collection:created', this

        $(exportObj).on 'xwing-backend:authenticationChanged', (e, authenticated, backend) =>
            # console.log "deauthed, destroying collection UI"
            @destroyUI() unless authenticated
        .on 'xwing-collection:saved', (e, collection) =>
            @modal_status.text 'Collection saved'
            @modal_status.fadeIn 100, =>
                @modal_status.fadeOut 5000
        .on 'xwing:languageChanged', @onLanguageChange

        $ @modal.find('input.expansion-count').change (e) =>
            target = $(e.target)
            val = target.val()
            target.val(0) if val < 0 or isNaN(parseInt(val))
            @expansions[target.data 'expansion'] = parseInt(target.val())

            target.closest('div').css 'background-color', @countToBackgroundColor(val)

            # console.log "Input changed, triggering collection change"
            $(exportObj).trigger 'xwing-collection:changed', this

        $ @modal.find('input.singleton-count').change (e) =>
            target = $(e.target)
            val = target.val()
            target.val(0) if val < 0 or isNaN(parseInt(val))
            (@singletons[target.data 'singletonType'] ?= {})[target.data 'singletonName'] = parseInt(target.val())

            target.closest('div').css 'background-color', @countToBackgroundColor(val)

            # console.log "Input changed, triggering collection change"
            $(exportObj).trigger 'xwing-collection:changed', this

    countToBackgroundColor: (count) ->
        count = parseInt(count)
        switch
            when count == 0
                ''
            when count < 12
                i = parseInt(200 * Math.pow(0.9, count - 1))
                "rgb(#{i}, 255, #{i})"
            else
                'red'

    onLanguageChange:
        (e, language) =>
            if language != @language
                # console.log "language changed to #{language}"
                do (language) =>
                    @modal.find('.expansion-name').each ->
                        # console.log "translating #{$(this).text()} (#{$(this).data('english_name')}) to #{language}"
                        $(this).text exportObj.translate language, 'sources', $(this).data('english_name')
                @language = language

###
    X-Wing Squad Builder
    Geordan Rosario <geordan@gmail.com>
    https://github.com/geordanr/xwing
###
DFL_LANGUAGE = 'English'

builders = []

exportObj = exports ? this

exportObj.loadCards = (language) ->
    exportObj.cardLoaders[language]()

exportObj.translate = (language, category, what, args...) ->
    translation = exportObj.translations[language][category][what]
    if translation?
        if translation instanceof Function
            # pass this function in case we need to do further translation inside the function
            translation exportObj.translate, language, args...
        else
            translation
    else
        what

exportObj.setupTranslationSupport = ->
    do (builders) ->
        $(exportObj).on 'xwing:languageChanged', (e, language, cb=$.noop) =>
            if language of exportObj.translations
                $('.language-placeholder').text language
                for builder in builders
                    await builder.container.trigger 'xwing:beforeLanguageLoad', defer()
                exportObj.loadCards language
                for own selector, html of exportObj.translations[language].byCSSSelector
                    $(selector).html html
                for builder in builders
                    builder.container.trigger 'xwing:afterLanguageLoad', language

    exportObj.loadCards DFL_LANGUAGE
    $(exportObj).trigger 'xwing:languageChanged', DFL_LANGUAGE

exportObj.setupTranslationUI = (backend) ->
    for language in Object.keys(exportObj.cardLoaders).sort()
        li = $ document.createElement 'LI'
        li.text language
        do (language, backend) ->
            li.click (e) ->
                backend.set('language', language) if backend?
                $(exportObj).trigger 'xwing:languageChanged', language
        $('ul.dropdown-menu').append li

exportObj.registerBuilderForTranslation = (builder) ->
    builders.push(builder) if builder not in builders

###
    X-Wing Squad Builder
    Geordan Rosario <geordan@gmail.com>
    https://github.com/geordanr/xwing
###
exportObj = exports ? this

exportObj.sortHelper = (a, b) ->
    if a.points == b.points
        a_name = a.text.replace(/[^a-z0-9]/ig, '')
        b_name = b.text.replace(/[^a-z0-9]/ig, '')
        if a_name == b_name
            0
        else
            if a_name > b_name then 1 else -1
    else
        if a.points > b.points then 1 else -1

$.isMobile = ->
    navigator.userAgent.match /(iPhone|iPod|iPad|Android)/i

$.randomInt = (n) ->
    Math.floor(Math.random() * n)

# ripped from http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values
$.getParameterByName = (name) ->
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]")
    regexS = "[\\?&]" + name + "=([^&#]*)"
    regex = new RegExp(regexS)
    results = regex.exec(window.location.search)
    if results == null
        return ""
    else
        return decodeURIComponent(results[1].replace(/\+/g, " "))

Array::intersects = (other) ->
    for item in this
        if item in other
            return true
    return false

Array::removeItem = (item) ->
    idx = @indexOf item
    @splice(idx, 1) unless idx == -1
    this

String::capitalize = ->
    @charAt(0).toUpperCase() + @slice(1)

String::getXWSBaseName = ->
    @split('-')[0]

URL_BASE = "#{window.location.protocol}//#{window.location.host}#{window.location.pathname}"
SQUAD_DISPLAY_NAME_MAX_LENGTH = 24

statAndEffectiveStat = (base_stat, effective_stats, key) ->
    """#{base_stat}#{if effective_stats[key] != base_stat then " (#{effective_stats[key]})" else ""}"""

getPrimaryFaction = (faction) ->
    switch faction
        when 'Rebel Alliance', 'Resistance'
            'Rebel Alliance'
        when 'Galactic Empire', 'First Order'
            'Galactic Empire'
        else
            faction

conditionToHTML = (condition) ->
    html = $.trim """
        <div class="condition">
            <div class="name">#{if condition.unique then "&middot;&nbsp;" else ""}#{condition.name}</div>
            <div class="text">#{condition.text}</div>
        </div>
    """

# Assumes cards.js will be loaded

class exportObj.SquadBuilder
    constructor: (args) ->
        # args
        @container = $ args.container
        @faction = $.trim args.faction
        @printable_container = $ args.printable_container
        @tab = $ args.tab

        # internal state
        @ships = []
        @uniques_in_use =
            Pilot:
                []
            Upgrade:
                []
            Modification:
                []
            Title:
                []
        @suppress_automatic_new_ship = false
        @tooltip_currently_displaying = null
        @randomizer_options =
            sources: null
            points: 100
        @total_points = 0
        @isCustom = false
        @isEpic = false
        @maxEpicPointsAllowed = 0
        @maxSmallShipsOfOneType = null
        @maxLargeShipsOfOneType = null

        @backend = null
        @current_squad = {}
        @language = 'English'

        @collection = null

        @current_obstacles = []

        @setupUI()
        @setupEventHandlers()

        window.setInterval @updatePermaLink, 250

        @isUpdatingPoints = false

        if $.getParameterByName('f') == @faction
            @resetCurrentSquad(true)
            @loadFromSerialized $.getParameterByName('d')
        else
            @resetCurrentSquad()
            @addShip()

    resetCurrentSquad: (initial_load=false) ->
        default_squad_name = 'Unnamed Squadron'

        squad_name = $.trim(@squad_name_input.val()) or default_squad_name
        if initial_load and $.trim $.getParameterByName('sn')
            squad_name = $.trim $.getParameterByName('sn')

        squad_obstacles = []
        if initial_load and $.trim $.getParameterByName('obs')
            squad_obstacles = ($.trim $.getParameterByName('obs')).split(",").slice(0, 3)
            @current_obstacles = squad_obstacles
        else if @current_obstacles
            squad_obstacles = @current_obstacles

        @current_squad =
            id: null
            name: squad_name
            dirty: false
            additional_data:
                points: @total_points
                description: ''
                cards: []
                notes: ''
                obstacles: squad_obstacles
            faction: @faction

        if @total_points > 0
            if squad_name == default_squad_name
                @current_squad.name = 'Unsaved Squadron'
            @current_squad.dirty = true
        @container.trigger 'xwing-backend:squadNameChanged'
        @container.trigger 'xwing-backend:squadDirtinessChanged'

    newSquadFromScratch: ->
        @squad_name_input.val 'New Squadron'
        @removeAllShips()
        @addShip()
        @current_obstacles = []
        @resetCurrentSquad()
        @notes.val ''

    setupUI: ->
        DEFAULT_RANDOMIZER_POINTS = 100
        DEFAULT_RANDOMIZER_TIMEOUT_SEC = 2
        DEFAULT_RANDOMIZER_ITERATIONS = 1000

        @status_container = $ document.createElement 'DIV'
        @status_container.addClass 'container-fluid'
        @status_container.append $.trim '''
            <div class="row-fluid">
                <div class="span3 squad-name-container">
                    <div class="display-name">
                        <span class="squad-name"></span>
                        <i class="fa fa-pencil"></i>
                    </div>
                    <div class="input-append">
                        <input type="text" maxlength="64" placeholder="Name your squad..." />
                    </div>
                </div>
                <div class="span4 points-display-container">
                    Points: <span class="total-points">0</span> / <input type="number" class="desired-points" value="100">
                    <select class="game-type-selector">
                        <option value="standard">Standard</option>
                    </select>
                    <span class="points-remaining-container">(<span class="points-remaining"></span>&nbsp;left)</span>
                    <span class="total-epic-points-container hidden"><br /><span class="total-epic-points">0</span> / <span class="max-epic-points">5</span> Epic Points</span>
                    <span class="content-warning unreleased-content-used hidden"><br /><i class="fa fa-exclamation-circle"></i>&nbsp;<span class="translated"></span></span>
                    <span class="content-warning epic-content-used hidden"><br /><i class="fa fa-exclamation-circle"></i>&nbsp;<span class="translated"></span></span>
                    <span class="content-warning illegal-epic-upgrades hidden"><br /><i class="fa fa-exclamation-circle"></i>&nbsp;Navigator cannot be equipped onto Huge ships in Epic tournament play!</span>
                    <span class="content-warning illegal-epic-too-many-small-ships hidden"><br /><i class="fa fa-exclamation-circle"></i>&nbsp;<span class="translated"></span></span>
                    <span class="content-warning illegal-epic-too-many-large-ships hidden"><br /><i class="fa fa-exclamation-circle"></i>&nbsp;<span class="translated"></span></span>
                    <span class="content-warning collection-invalid hidden"><br /><i class="fa fa-exclamation-circle"></i>&nbsp;<span class="translated"></span></span>
                </div>
                <div class="span5 pull-right button-container">
                    <div class="btn-group pull-right">

                        <button class="btn btn-primary view-as-text"><span class="hidden-phone"><i class="fa fa-print"></i>&nbsp;Print/View as </span>Text</button>
                        <!-- <button class="btn btn-primary print-list hidden-phone hidden-tablet"><i class="fa fa-print"></i>&nbsp;Print</button> -->
                        <a class="btn btn-primary hidden collection"><i class="fa fa-folder-open hidden-phone hidden-tabler"></i>&nbsp;Your Collection</a>

                        <!--
                        <button class="btn btn-primary randomize" ><i class="fa fa-random hidden-phone hidden-tablet"></i>&nbsp;Random!</button>
                        <button class="btn btn-primary dropdown-toggle" data-toggle="dropdown">
                            <span class="caret"></span>
                        </button>
                        <ul class="dropdown-menu">
                            <li><a class="randomize-options">Randomizer Options...</a></li>
                        </ul>
                        -->

                    </div>
                </div>
            </div>
        '''
        @container.append @status_container

        @list_modal = $ document.createElement 'DIV'
        @list_modal.addClass 'modal hide fade text-list-modal'
        @container.append @list_modal
        @list_modal.append $.trim """
            <div class="modal-header">
                <button type="button" class="close hidden-print" data-dismiss="modal" aria-hidden="true">&times;</button>

                <div class="hidden-phone hidden-print">
                    <h3><span class="squad-name"></span> (<span class="total-points"></span>)<h3>
                </div>

                <div class="visible-phone hidden-print">
                    <h4><span class="squad-name"></span> (<span class="total-points"></span>)<h4>
                </div>

                <div class="visible-print">
                    <div class="fancy-header">
                        <div class="squad-name"></div>
                        <div class="squad-faction"></div>
                        <div class="mask">
                            <div class="outer-circle">
                                <div class="inner-circle">
                                    <span class="total-points"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="fancy-under-header"></div>
                </div>

            </div>
            <div class="modal-body">
                <div class="fancy-list hidden-phone"></div>
                <div class="simple-list"></div>
                <div class="bbcode-list">
                    <p>Copy the BBCode below and paste it into your forum post.</p>
                    <textarea></textarea><button class="btn btn-copy">Copy</button>
                </div>
                <div class="html-list">
                    <textarea></textarea><button class="btn btn-copy">Copy</button>
                </div>
            </div>
            <div class="modal-footer hidden-print">
                <label class="vertical-space-checkbox">
                    Add space for damage/upgrade cards when printing <input type="checkbox" class="toggle-vertical-space" />
                </label>
                <label class="color-print-checkbox">
                    Print color <input type="checkbox" class="toggle-color-print" />
                </label>
                <label class="qrcode-checkbox hidden-phone">
                    Include QR codes <input type="checkbox" class="toggle-juggler-qrcode" checked="checked" />
                </label>
                <label class="qrcode-checkbox hidden-phone">
                    Include obstacle/damage deck choices <input type="checkbox" class="toggle-obstacles" />
                </label>
                <div class="btn-group list-display-mode">
                    <button class="btn select-simple-view">Simple</button>
                    <button class="btn select-fancy-view hidden-phone">Fancy</button>
                    <button class="btn select-bbcode-view">BBCode</button>
                    <button class="btn select-html-view">HTML</button>
                </div>
                <button class="btn print-list hidden-phone"><i class="fa fa-print"></i>&nbsp;Print</button>
                <button class="btn close-print-dialog" data-dismiss="modal" aria-hidden="true">Close</button>
            </div>
        """
        @fancy_container = $ @list_modal.find('div.modal-body .fancy-list')
        @fancy_total_points_container = $ @list_modal.find('div.modal-header .total-points')
        @simple_container = $ @list_modal.find('div.modal-body .simple-list')
        @bbcode_container = $ @list_modal.find('div.modal-body .bbcode-list')
        @bbcode_textarea = $ @bbcode_container.find('textarea')
        @bbcode_textarea.attr 'readonly', 'readonly'
        @htmlview_container = $ @list_modal.find('div.modal-body .html-list')
        @html_textarea = $ @htmlview_container.find('textarea')
        @html_textarea.attr 'readonly', 'readonly'
        @toggle_vertical_space_container = $ @list_modal.find('.vertical-space-checkbox')
        @toggle_color_print_container = $ @list_modal.find('.color-print-checkbox')

        @list_modal.on 'click', 'button.btn-copy', (e) =>
            @self = $(e.currentTarget)
            @self.siblings('textarea').select()
            @success = document.execCommand('copy')
            if @success
                @self.addClass 'btn-success'
                setTimeout ( =>
                    @self.removeClass 'btn-success'
                ), 1000

        @select_simple_view_button = $ @list_modal.find('.select-simple-view')
        @select_simple_view_button.click (e) =>
            @select_simple_view_button.blur()
            unless @list_display_mode == 'simple'
                @list_modal.find('.list-display-mode .btn').removeClass 'btn-inverse'
                @select_simple_view_button.addClass 'btn-inverse'
                @list_display_mode = 'simple'
                @simple_container.show()
                @fancy_container.hide()
                @bbcode_container.hide()
                @htmlview_container.hide()
                @toggle_vertical_space_container.hide()
                @toggle_color_print_container.hide()

        @select_fancy_view_button = $ @list_modal.find('.select-fancy-view')
        @select_fancy_view_button.click (e) =>
            @select_fancy_view_button.blur()
            unless @list_display_mode == 'fancy'
                @list_modal.find('.list-display-mode .btn').removeClass 'btn-inverse'
                @select_fancy_view_button.addClass 'btn-inverse'
                @list_display_mode = 'fancy'
                @fancy_container.show()
                @simple_container.hide()
                @bbcode_container.hide()
                @htmlview_container.hide()
                @toggle_vertical_space_container.show()
                @toggle_color_print_container.show()

        @select_bbcode_view_button = $ @list_modal.find('.select-bbcode-view')
        @select_bbcode_view_button.click (e) =>
            @select_bbcode_view_button.blur()
            unless @list_display_mode == 'bbcode'
                @list_modal.find('.list-display-mode .btn').removeClass 'btn-inverse'
                @select_bbcode_view_button.addClass 'btn-inverse'
                @list_display_mode = 'bbcode'
                @bbcode_container.show()
                @htmlview_container.hide()
                @simple_container.hide()
                @fancy_container.hide()
                @bbcode_textarea.select()
                @bbcode_textarea.focus()
                @toggle_vertical_space_container.show()
                @toggle_color_print_container.show()

        @select_html_view_button = $ @list_modal.find('.select-html-view')
        @select_html_view_button.click (e) =>
            @select_html_view_button.blur()
            unless @list_display_mode == 'html'
                @list_modal.find('.list-display-mode .btn').removeClass 'btn-inverse'
                @select_html_view_button.addClass 'btn-inverse'
                @list_display_mode = 'html'
                @bbcode_container.hide()
                @htmlview_container.show()
                @simple_container.hide()
                @fancy_container.hide()
                @html_textarea.select()
                @html_textarea.focus()
                @toggle_vertical_space_container.show()
                @toggle_color_print_container.show()

        if $(window).width() >= 768
            @simple_container.hide()
            @select_fancy_view_button.click()
        else
            @select_simple_view_button.click()

        @clear_squad_button = $ @status_container.find('.clear-squad')
        @clear_squad_button.click (e) =>
            if @current_squad.dirty and @backend?
                @backend.warnUnsaved this, () =>
                    @newSquadFromScratch()
            else
                @newSquadFromScratch()

        @squad_name_container = $ @status_container.find('div.squad-name-container')
        @squad_name_display = $ @container.find('.display-name')
        @squad_name_placeholder = $ @container.find('.squad-name')
        @squad_name_input = $ @squad_name_container.find('input')
        @squad_name_save_button = $ @squad_name_container.find('button.save')
        @squad_name_input.closest('div').hide()
        @points_container = $ @status_container.find('div.points-display-container')
        @total_points_span = $ @points_container.find('.total-points')
        @game_type_selector = $ @status_container.find('.game-type-selector')
        @game_type_selector.change (e) =>
            @onGameTypeChanged @game_type_selector.val()
        @desired_points_input = $ @points_container.find('.desired-points')
        @desired_points_input.change (e) =>
            @game_type_selector.val 'custom'
            @onGameTypeChanged 'custom'
        @points_remaining_span = $ @points_container.find('.points-remaining')
        @points_remaining_container = $ @points_container.find('.points-remaining-container')
        @unreleased_content_used_container = $ @points_container.find('.unreleased-content-used')
        @epic_content_used_container = $ @points_container.find('.epic-content-used')
        @illegal_epic_upgrades_container = $ @points_container.find('.illegal-epic-upgrades')
        @too_many_small_ships_container = $ @points_container.find('.illegal-epic-too-many-small-ships')
        @too_many_large_ships_container = $ @points_container.find('.illegal-epic-too-many-large-ships')
        @collection_invalid_container = $ @points_container.find('.collection-invalid')
        @total_epic_points_container = $ @points_container.find('.total-epic-points-container')
        @total_epic_points_span = $ @total_epic_points_container.find('.total-epic-points')
        @max_epic_points_span = $ @points_container.find('.max-epic-points')
        @view_list_button = $ @status_container.find('div.button-container button.view-as-text')
        @randomize_button = $ @status_container.find('div.button-container button.randomize')
        @customize_randomizer = $ @status_container.find('div.button-container a.randomize-options')
        @backend_status = $ @status_container.find('.backend-status')
        @backend_status.hide()

        @collection_button = $ @status_container.find('div.button-container a.collection')
        @collection_button.click (e) =>
            e.preventDefault()
            unless @collection_button.prop('disabled')
                @collection.modal.modal 'show'

        @squad_name_input.keypress (e) =>
            if e.which == 13
                @squad_name_save_button.click()
                false

        @squad_name_input.change (e) =>
            @backend_status.fadeOut 'slow'

        @squad_name_input.blur (e) =>
            @squad_name_input.change()
            @squad_name_save_button.click()

        @squad_name_display.click (e) =>
            e.preventDefault()
            @squad_name_display.hide()
            @squad_name_input.val $.trim(@current_squad.name)
            # Because Firefox handles this badly
            window.setTimeout () =>
                @squad_name_input.focus()
                @squad_name_input.select()
            , 100
            @squad_name_input.closest('div').show()
        @squad_name_save_button.click (e) =>
            e.preventDefault()
            @current_squad.dirty = true
            @container.trigger 'xwing-backend:squadDirtinessChanged'
            name = @current_squad.name = $.trim(@squad_name_input.val())
            if name.length > 0
                @squad_name_display.show()
                @container.trigger 'xwing-backend:squadNameChanged'
                @squad_name_input.closest('div').hide()

        @randomizer_options_modal = $ document.createElement('DIV')
        @randomizer_options_modal.addClass 'modal hide fade'
        $('body').append @randomizer_options_modal
        @randomizer_options_modal.append $.trim """
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                <h3>Random Squad Builder Options</h3>
            </div>
            <div class="modal-body">
                <form>
                    <label>
                        Desired Points
                        <input type="number" class="randomizer-points" value="#{DEFAULT_RANDOMIZER_POINTS}" placeholder="#{DEFAULT_RANDOMIZER_POINTS}" />
                    </label>
                    <label>
                        Sets and Expansions (default all)
                        <select class="randomizer-sources" multiple="1" data-placeholder="Use all sets and expansions">
                        </select>
                    </label>
                    <label>
                        Maximum Seconds to Spend Randomizing
                        <input type="number" class="randomizer-timeout" value="#{DEFAULT_RANDOMIZER_TIMEOUT_SEC}" placeholder="#{DEFAULT_RANDOMIZER_TIMEOUT_SEC}" />
                    </label>
                    <label>
                        Maximum Randomization Iterations
                        <input type="number" class="randomizer-iterations" value="#{DEFAULT_RANDOMIZER_ITERATIONS}" placeholder="#{DEFAULT_RANDOMIZER_ITERATIONS}" />
                    </label>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary do-randomize" aria-hidden="true">Randomize!</button>
                <button class="btn" data-dismiss="modal" aria-hidden="true">Close</button>
            </div>
        """
        @randomizer_source_selector = $ @randomizer_options_modal.find('select.randomizer-sources')
        for expansion in exportObj.expansions
            opt = $ document.createElement('OPTION')
            opt.text expansion
            @randomizer_source_selector.append opt
        @randomizer_source_selector.select2
            width: "100%"
            minimumResultsForSearch: if $.isMobile() then -1 else 0

        @randomize_button.click (e) =>
            e.preventDefault()
            if @current_squad.dirty and @backend?
                @backend.warnUnsaved this, () =>
                    @randomize_button.click()
            else
                points = parseInt $(@randomizer_options_modal.find('.randomizer-points')).val()
                points = DEFAULT_RANDOMIZER_POINTS if (isNaN(points) or points <= 0)
                timeout_sec = parseInt $(@randomizer_options_modal.find('.randomizer-timeout')).val()
                timeout_sec = DEFAULT_RANDOMIZER_TIMEOUT_SEC if (isNaN(timeout_sec) or timeout_sec <= 0)
                iterations = parseInt $(@randomizer_options_modal.find('.randomizer-iterations')).val()
                iterations = DEFAULT_RANDOMIZER_ITERATIONS if (isNaN(iterations) or iterations <= 0)
                #console.log "points=#{points}, sources=#{@randomizer_source_selector.val()}, timeout=#{timeout_sec}, iterations=#{iterations}"
                @randomSquad(points, @randomizer_source_selector.val(), DEFAULT_RANDOMIZER_TIMEOUT_SEC * 1000, iterations)

        @randomizer_options_modal.find('button.do-randomize').click (e) =>
            e.preventDefault()
            @randomizer_options_modal.modal('hide')
            @randomize_button.click()

        @customize_randomizer.click (e) =>
            e.preventDefault()
            @randomizer_options_modal.modal()

        @choose_obstacles_modal = $ document.createElement 'DIV'
        @choose_obstacles_modal.addClass 'modal hide fade choose-obstacles-modal'
        @container.append @choose_obstacles_modal
        @choose_obstacles_modal.append $.trim """
            <div class="modal-header">
                <label class='choose-obstacles-description'>Choose up to three obstacles, to include in the permalink for use in external programs</label>
            </div>
            <div class="modal-body">
                <div class="obstacle-select-container" style="float:left">
                    <select multiple class='obstacle-select' size="18">
                        <option class="coreasteroid0-select" value="coreasteroid0">Core Asteroid 0</option>
                        <option class="coreasteroid1-select" value="coreasteroid1">Core Asteroid 1</option>
                        <option class="coreasteroid2-select" value="coreasteroid2">Core Asteroid 2</option>
                        <option class="coreasteroid3-select" value="coreasteroid3">Core Asteroid 3</option>
                        <option class="coreasteroid4-select" value="coreasteroid4">Core Asteroid 4</option>
                        <option class="coreasteroid5-select" value="coreasteroid5">Core Asteroid 5</option>
                        <option class="yt2400debris0-select" value="yt2400debris0">YT2400 Debris 0</option>
                        <option class="yt2400debris1-select" value="yt2400debris1">YT2400 Debris 1</option>
                        <option class="yt2400debris2-select" value="yt2400debris2">YT2400 Debris 2</option>
                        <option class="vt49decimatordebris0-select" value="vt49decimatordebris0">VT49 Debris 0</option>
                        <option class="vt49decimatordebris1-select" value="vt49decimatordebris1">VT49 Debris 1</option>
                        <option class="vt49decimatordebris2-select" value="vt49decimatordebris2">VT49 Debris 2</option>
                        <option class="core2asteroid0-select" value="core2asteroid0">Force Awakens Asteroid 0</option>
                        <option class="core2asteroid1-select" value="core2asteroid1">Force Awakens Asteroid 1</option>
                        <option class="core2asteroid2-select" value="core2asteroid2">Force Awakens Asteroid 2</option>
                        <option class="core2asteroid3-select" value="core2asteroid3">Force Awakens Asteroid 3</option>
                        <option class="core2asteroid4-select" value="core2asteroid4">Force Awakens Asteroid 4</option>
                        <option class="core2asteroid5-select" value="core2asteroid5">Force Awakens Asteroid 5</option>
                    </select>
                </div>
                <div class="obstacle-image-container" style="display:none;">
                    <img class="obstacle-image" src="images/core2asteroid0.png" />
                </div>
            </div>
            <div class="modal-footer hidden-print">
                <button class="btn close-print-dialog" data-dismiss="modal" aria-hidden="true">Close</button>
            </div>
        """
        @obstacles_select = @choose_obstacles_modal.find('.obstacle-select')
        @obstacles_select_image = @choose_obstacles_modal.find('.obstacle-image-container')

        # Backend

        @backend_list_squads_button = $ @container.find('button.backend-list-my-squads')
        @backend_list_squads_button.click (e) =>
            e.preventDefault()
            if @backend?
                @backend.list this
        #@backend_list_all_squads_button = $ @container.find('button.backend-list-all-squads')
        #@backend_list_all_squads_button.click (e) =>
        #    e.preventDefault()
        #    if @backend?
        #        @backend.list this, true
        @backend_save_list_button = $ @container.find('button.save-list')
        @backend_save_list_button.click (e) =>
            e.preventDefault()
            if @backend? and not @backend_save_list_button.hasClass('disabled')
                additional_data =
                    points: @total_points
                    description: @describeSquad()
                    cards: @listCards()
                    notes: @notes.val().substr(0, 1024)
                    obstacles: @getObstacles()
                @backend_status.html $.trim """
                    <i class="fa fa-refresh fa-spin"></i>&nbsp;Saving squad...
                """
                @backend_status.show()
                @backend_save_list_button.addClass 'disabled'
                await @backend.save @serialize(), @current_squad.id, @current_squad.name, @faction, additional_data, defer(results)
                if results.success
                    @current_squad.dirty = false
                    if @current_squad.id?
                        @backend_status.html $.trim """
                            <i class="fa fa-check"></i>&nbsp;Squad updated successfully.
                        """
                    else
                        @backend_status.html $.trim """
                            <i class="fa fa-check"></i>&nbsp;New squad saved successfully.
                        """
                        @current_squad.id = results.id
                    @container.trigger 'xwing-backend:squadDirtinessChanged'
                else
                    @backend_status.html $.trim """
                        <i class="fa fa-exclamation-circle"></i>&nbsp;#{results.error}
                    """
                    @backend_save_list_button.removeClass 'disabled'
        @backend_save_list_as_button = $ @container.find('button.save-list-as')
        @backend_save_list_as_button.addClass 'disabled'
        @backend_save_list_as_button.click (e) =>
            e.preventDefault()
            if @backend? and not @backend_save_list_as_button.hasClass('disabled')
                @backend.showSaveAsModal this
        @backend_delete_list_button = $ @container.find('button.delete-list')
        @backend_delete_list_button.click (e) =>
            e.preventDefault()
            if @backend? and not @backend_delete_list_button.hasClass('disabled')

                @backend.showDeleteModal this

        content_container = $ document.createElement 'DIV'
        content_container.addClass 'container-fluid'
        @container.append content_container
        content_container.append $.trim """
            <div class="row-fluid">
                <div class="span9 ship-container">
                    <label class="notes-container show-authenticated">
                        <span class="squad-notes">Squad Notes:</span>
                        <br />
                        <textarea class="squad-notes"></textarea>
                    </label>
                    <span class="obstacles-container">
                    </span>
                 </div>
               <div class="span3 info-container" />
            </div>
        """

        @ship_container = $ content_container.find('div.ship-container')
        @info_container = $ content_container.find('div.info-container')
        @obstacles_container = content_container.find('.obstacles-container')
        @notes_container = $ content_container.find('.notes-container')
        @notes = $ @notes_container.find('textarea.squad-notes')

        @info_container.append $.trim """
            <div class="well well-small info-well">
                <span class="info-name"></span>
                <br />
                <span class="info-sources"></span>
                <br />
                <span class="info-collection"></span>
                <table>
                    <tbody>
                        <tr class="info-ship">
                            <td class="info-header">Ship</td>
                            <td class="info-data"></td>
                        </tr>
                        <tr class="info-skill">
                            <td class="info-header">Skill</td>
                            <td class="info-data info-skill"></td>
                        </tr>
                        <tr class="info-energy">
                            <td class="info-header"><i class="xwing-miniatures-font xwing-miniatures-font-energy"></i></td>
                            <td class="info-data info-energy"></td>
                        </tr>
                        <tr class="info-attack">
                            <td class="info-header"><i class="xwing-miniatures-font xwing-miniatures-font-attack"></i></td>
                            <td class="info-data info-attack"></td>
                        </tr>
                        <tr class="info-range">
                            <td class="info-header">Range</td>
                            <td class="info-data info-range"></td>
                        </tr>
                        <tr class="info-agility">
                            <td class="info-header"><i class="xwing-miniatures-font xwing-miniatures-font-agility"></i></td>
                            <td class="info-data info-agility"></td>
                        </tr>
                        <tr class="info-hull">
                            <td class="info-header"><i class="xwing-miniatures-font xwing-miniatures-font-hull"></i></td>
                            <td class="info-data info-hull"></td>
                        </tr>
                        <tr class="info-shields">
                            <td class="info-header"><i class="xwing-miniatures-font xwing-miniatures-font-shield"></i></td>
                            <td class="info-data info-shields"></td>
                        </tr>
                        <tr class="info-actions">
                            <td class="info-header">Actions</td>
                            <td class="info-data"></td>
                        </tr>
                        <tr class="info-upgrades">
                            <td class="info-header">Upgrades</td>
                            <td class="info-data"></td>
                        </tr>
                    </tbody>
                </table>
                <p class="info-text" />
                <p class="info-maneuvers" />
            </div>
        """
        @info_container.hide()

        @print_list_button = $ @container.find('button.print-list')

        @container.find('[rel=tooltip]').tooltip()

        # obstacles
        @obstacles_button = $ @container.find('button.choose-obstacles')
        @obstacles_button.click (e) =>
            e.preventDefault()
            @showChooseObstaclesModal()

        # conditions
        @condition_container = $ document.createElement('div')
        @condition_container.addClass 'conditions-container'
        @container.append @condition_container

    setupEventHandlers: ->
        @container.on 'xwing:claimUnique', (e, unique, type, cb) =>
            @claimUnique unique, type, cb
        .on 'xwing:releaseUnique', (e, unique, type, cb) =>
            @releaseUnique unique, type, cb
        .on 'xwing:pointsUpdated', (e, cb=$.noop) =>
            if @isUpdatingPoints
                cb()
            else
                @isUpdatingPoints = true
                @onPointsUpdated () =>
                    @isUpdatingPoints = false
                    cb()
        .on 'xwing-backend:squadLoadRequested', (e, squad) =>
            @onSquadLoadRequested squad
        .on 'xwing-backend:squadDirtinessChanged', (e) =>
            @onSquadDirtinessChanged()
        .on 'xwing-backend:squadNameChanged', (e) =>
            @onSquadNameChanged()
        .on 'xwing:beforeLanguageLoad', (e, cb=$.noop) =>
            @pretranslation_serialized = @serialize()
            # Need to remove ships here because the cards will change when the
            # new language is loaded, and we don't want to have problems with
            # unclaiming uniques.
            # Preserve squad dirtiness
            old_dirty = @current_squad.dirty
            @removeAllShips()
            @current_squad.dirty = old_dirty
            cb()
        .on 'xwing:afterLanguageLoad', (e, language, cb=$.noop) =>
            @language = language
            old_dirty = @current_squad.dirty
            @loadFromSerialized @pretranslation_serialized
            for ship in @ships
                ship.updateSelections()
            @current_squad.dirty = old_dirty
            @pretranslation_serialized = undefined
            cb()
        # Recently moved this here.  Did this ever work?
        .on 'xwing:shipUpdated', (e, cb=$.noop) =>
            all_allocated = true
            for ship in @ships
                ship.updateSelections()
                if ship.ship_selector.val() == ''
                    all_allocated = false
            #console.log "all_allocated is #{all_allocated}, suppress_automatic_new_ship is #{@suppress_automatic_new_ship}"
            #console.log "should we add ship: #{all_allocated and not @suppress_automatic_new_ship}"
            @addShip() if all_allocated and not @suppress_automatic_new_ship

        $(window).on 'xwing-backend:authenticationChanged', (e) =>
            @resetCurrentSquad()

        .on 'xwing-collection:created', (e, collection) =>
            # console.log "#{@faction}: collection was created"
            @collection = collection
            # console.log "#{@faction}: Collection created, checking squad"
            @collection.onLanguageChange null, @language
            @checkCollection()
            @collection_button.removeClass 'hidden'
        .on 'xwing-collection:changed', (e, collection) =>
            # console.log "#{@faction}: Collection changed, checking squad"
            @checkCollection()
        .on 'xwing-collection:destroyed', (e, collection) =>
            @collection = null
            @collection_button.addClass 'hidden'
        .on 'xwing:pingActiveBuilder', (e, cb) =>
            cb(this) if @container.is(':visible')
        .on 'xwing:activateBuilder', (e, faction, cb) =>
            if faction == @faction
                @tab.tab('show')
                cb this

        @obstacles_select.change (e) =>
            if @obstacles_select.val().length > 3
                @obstacles_select.val(@current_squad.additional_data.obstacles)
            else
                previous_obstacles = @current_squad.additional_data.obstacles
                @current_obstacles = (o for o in @obstacles_select.val())
                if (previous_obstacles?)
                    new_selection = @current_obstacles.filter((element) => return previous_obstacles.indexOf(element) == -1)
                else
                    new_selection = @current_obstacles
                if new_selection.length > 0
                    @showChooseObstaclesSelectImage(new_selection[0])
                @current_squad.additional_data.obstacles = @current_obstacles
                @current_squad.dirty = true
                @container.trigger 'xwing-backend:squadDirtinessChanged'

        @view_list_button.click (e) =>
            e.preventDefault()
            @showTextListModal()

        @print_list_button.click (e) =>
            e.preventDefault()
            # Copy text list to printable
            @printable_container.find('.printable-header').html @list_modal.find('.modal-header').html()
            @printable_container.find('.printable-body').text ''
            switch @list_display_mode
                when 'simple'
                    @printable_container.find('.printable-body').html @simple_container.html()
                else
                    for ship in @ships
                        @printable_container.find('.printable-body').append ship.toHTML() if ship.pilot?
                    @printable_container.find('.fancy-ship').toggleClass 'tall', @list_modal.find('.toggle-vertical-space').prop('checked')
                    @printable_container.find('.printable-body').toggleClass 'bw', not @list_modal.find('.toggle-color-print').prop('checked')

                    faction = switch @faction
                        when 'Rebel Alliance'
                            'rebel'
                        when 'Galactic Empire'
                            'empire'
                        when 'Scum and Villainy'
                            'scum'
                    @printable_container.find('.squad-faction').html """<i class="xwing-miniatures-font xwing-miniatures-font-#{faction}"></i>"""

            # Conditions
            @printable_container.find('.printable-body').append $.trim """
                <div class="print-conditions"></div>
            """
            @printable_container.find('.printable-body .print-conditions').html @condition_container.html()


            # Notes, if present
            if $.trim(@notes.val()) != ''
                @printable_container.find('.printable-body').append $.trim """
                    <h5 class="print-notes">Notes:</h5>
                    <pre class="print-notes"></pre>
                """
                @printable_container.find('.printable-body pre.print-notes').text @notes.val()

            # Obstacles
            if @list_modal.find('.toggle-obstacles').prop('checked')
                @printable_container.find('.printable-body').append $.trim """
                    <div class="obstacles">
                        <div>Mark the three obstacles you are using.</div>
                        <img class="obstacle-silhouettes" src="images/xws-obstacles.png" />
                        <div>Mark which damage deck you are using.</div>
                        <div><i class="fa fa-square-o"></i>Original Core Set&nbsp;&nbsp&nbsp;<i class="fa fa-square-o"></i>The Force Awakens Core Set</div>
                    </div>
                """

            # Add List Juggler QR code
            query = @getPermaLinkParams(['sn', 'obs'])
            if query? and @list_modal.find('.toggle-juggler-qrcode').prop('checked')
                @printable_container.find('.printable-body').append $.trim """
                <div class="qrcode-container">
                    <div class="permalink-container">
                        <div class="qrcode"></div>
                        <div class="qrcode-text">Scan to open this list in the builder</div>
                    </div>
                    <div class="juggler-container">
                        <div class="qrcode"></div>
                        <div class="qrcode-text">TOs: Scan to load this squad into List Juggler</div>
                    </div>
                </div>
                """
                text = "https://yasb-xws.herokuapp.com/juggler#{query}"
                @printable_container.find('.juggler-container .qrcode').qrcode
                    render: 'div'
                    ec: 'M'
                    size: if text.length < 144 then 144 else 160
                    text: text
                text = "https://geordanr.github.io/xwing/#{query}"
                @printable_container.find('.permalink-container .qrcode').qrcode
                    render: 'div'
                    ec: 'M'
                    size: if text.length < 144 then 144 else 160
                    text: text

            window.print()

        $(window).resize =>
            @select_simple_view_button.click() if $(window).width() < 768 and @list_display_mode != 'simple'

         @notes.change @onNotesUpdated

         @notes.on 'keyup', @onNotesUpdated

    getPermaLinkParams: (ignored_params=[]) =>
        params = {}
        params.f = encodeURI(@faction) unless 'f' in ignored_params
        params.d = encodeURI(@serialize()) unless 'd' in ignored_params
        params.sn = encodeURIComponent(@current_squad.name) unless 'sn' in ignored_params
        params.obs = encodeURI(@current_squad.additional_data.obstacles || '') unless 'obs' in ignored_params
        return "?" + ("#{k}=#{v}" for k, v of params).join("&")

    getPermaLink: (params=@getPermaLinkParams()) => "#{URL_BASE}#{params}"

    updatePermaLink: () =>
        return unless @container.is(':visible') # gross but couldn't make clearInterval work
        next_params = @getPermaLinkParams()
        if window.location.search != next_params
          window.history.replaceState(next_params, '', @getPermaLink(next_params))

    onNotesUpdated: =>
        if @total_points > 0
            @current_squad.dirty = true
            @container.trigger 'xwing-backend:squadDirtinessChanged'

    onGameTypeChanged: (gametype, cb=$.noop) =>
        switch gametype
            when 'standard'
                @isEpic = false
                @isCustom = false
                @desired_points_input.val 100
                @maxSmallShipsOfOneType = null
                @maxLargeShipsOfOneType = null
            when 'epic'
                @isEpic = true
                @isCustom = false
                @maxEpicPointsAllowed = 5
                @desired_points_input.val 300
                @maxSmallShipsOfOneType = 12
                @maxLargeShipsOfOneType = 6
            when 'team-epic'
                @isEpic = true
                @isCustom = false
                @maxEpicPointsAllowed = 3
                @desired_points_input.val 200
                @maxSmallShipsOfOneType = 8
                @maxLargeShipsOfOneType = 4
            when 'custom'
                @isEpic = false
                @isCustom = true
                @maxSmallShipsOfOneType = null
                @maxLargeShipsOfOneType = null
        @max_epic_points_span.text @maxEpicPointsAllowed
        @onPointsUpdated cb

    onPointsUpdated: (cb=$.noop) =>
        @total_points = 0
        @total_epic_points = 0
        unreleased_content_used = false
        epic_content_used = false
        for ship, i in @ships
            ship.validate()
            @total_points += ship.getPoints()
            @total_epic_points += ship.getEpicPoints()
            ship_uses_unreleased_content = ship.checkUnreleasedContent()
            unreleased_content_used = ship_uses_unreleased_content if ship_uses_unreleased_content
            ship_uses_epic_content = ship.checkEpicContent()
            epic_content_used = ship_uses_epic_content if ship_uses_epic_content
        @total_points_span.text @total_points
        points_left = parseInt(@desired_points_input.val()) - @total_points
        @points_remaining_span.text points_left
        @points_remaining_container.toggleClass 'red', (points_left < 0)
        @unreleased_content_used_container.toggleClass 'hidden', not unreleased_content_used
        @epic_content_used_container.toggleClass 'hidden', (@isEpic or not epic_content_used)

        # Check against Epic restrictions if applicable
        @illegal_epic_upgrades_container.toggleClass 'hidden', true
        @too_many_small_ships_container.toggleClass 'hidden', true
        @too_many_large_ships_container.toggleClass 'hidden', true
        @total_epic_points_container.toggleClass 'hidden', true
        if @isEpic
            @total_epic_points_container.toggleClass 'hidden', false
            @total_epic_points_span.text @total_epic_points
            @total_epic_points_span.toggleClass 'red', (@total_epic_points > @maxEpicPointsAllowed)
            shipCountsByType = {}
            illegal_for_epic = false
            for ship, i in @ships
                if ship?.data?
                    shipCountsByType[ship.data.name] ?= 0
                    shipCountsByType[ship.data.name] += 1
                    if ship.data.huge?
                        for upgrade in ship.upgrades
                            if upgrade?.data?.epic_restriction_func?
                                unless upgrade.data.epic_restriction_func(ship.data, upgrade)
                                    illegal_for_epic = true
                                    break
                            break if illegal_for_epic
            @illegal_epic_upgrades_container.toggleClass 'hidden', not illegal_for_epic
            if @maxLargeShipsOfOneType? and @maxSmallShipsOfOneType?
                for ship_name, count of shipCountsByType
                    ship_data = exportObj.ships[ship_name]
                    if ship_data.large? and count > @maxLargeShipsOfOneType
                        @too_many_large_ships_container.toggleClass 'hidden', false
                    else if not ship.huge? and count > @maxSmallShipsOfOneType
                        @too_many_small_ships_container.toggleClass 'hidden', false

        @fancy_total_points_container.text @total_points

        # update text list
        @fancy_container.text ''
        @simple_container.html '<table class="simple-table"></table>'
        bbcode_ships = []
        htmlview_ships = []
        for ship in @ships
            if ship.pilot?
                @fancy_container.append ship.toHTML()
                @simple_container.find('table').append ship.toTableRow()
                bbcode_ships.push ship.toBBCode()
                htmlview_ships.push ship.toSimpleHTML()
        @htmlview_container.find('textarea').val $.trim """#{htmlview_ships.join '<br />'}
<br />
<b><i>Total: #{@total_points}</i></b>
<br />
<a href="#{@getPermaLink()}">View in Yet Another Squad Builder</a>
        """
        @bbcode_container.find('textarea').val $.trim """#{bbcode_ships.join "\n\n"}

[b][i]Total: #{@total_points}[/i][/b]

[url=#{@getPermaLink()}]View in Yet Another Squad Builder[/url]
"""
        # console.log "#{@faction}: Squad updated, checking collection"
        @checkCollection()

        # update conditions used
        # this old version of phantomjs i'm using doesn't support Set
        if Set?
            conditions_set = new Set()
            for ship in @ships
                # shouldn't there be a set union
                ship.getConditions().forEach (condition) ->
                    conditions_set.add(condition)
            conditions = []
            conditions_set.forEach (condition) ->
                conditions.push(condition)
            conditions.sort (a, b) ->
                if a.name.canonicalize() < b.name.canonicalize()
                    -1
                else if b.name.canonicalize() > a.name.canonicalize()
                    1
                else
                    0
            @condition_container.text ''
            conditions.forEach (condition) =>
                @condition_container.append conditionToHTML(condition)

        cb @total_points

    onSquadLoadRequested: (squad) =>
        console.log(squad.additional_data.obstacles)
        @current_squad = squad
        @backend_delete_list_button.removeClass 'disabled'
        @squad_name_input.val @current_squad.name
        @squad_name_placeholder.text @current_squad.name
        @current_obstacles = @current_squad.additional_data.obstacles
        @updateObstacleSelect(@current_squad.additional_data.obstacles)
        @loadFromSerialized squad.serialized
        @notes.val(squad.additional_data.notes ? '')
        @backend_status.fadeOut 'slow'
        @current_squad.dirty = false
        @container.trigger 'xwing-backend:squadDirtinessChanged'

    onSquadDirtinessChanged: () =>
        @backend_save_list_button.toggleClass 'disabled', not (@current_squad.dirty and @total_points > 0)
        @backend_save_list_as_button.toggleClass 'disabled', @total_points == 0
        @backend_delete_list_button.toggleClass 'disabled', not @current_squad.id?

    onSquadNameChanged: () =>
        if @current_squad.name.length > SQUAD_DISPLAY_NAME_MAX_LENGTH
            short_name = "#{@current_squad.name.substr(0, SQUAD_DISPLAY_NAME_MAX_LENGTH)}&hellip;"
        else
            short_name = @current_squad.name
        @squad_name_placeholder.text ''
        @squad_name_placeholder.append short_name
        @squad_name_input.val @current_squad.name

    removeAllShips: ->
        while @ships.length > 0
            @removeShip @ships[0]
        throw new Error("Ships not emptied") if @ships.length > 0

    showTextListModal: ->
        # Display modal
        @list_modal.modal 'show'

    showChooseObstaclesModal: ->
        @obstacles_select.val(@current_squad.additional_data.obstacles)
        @choose_obstacles_modal.modal 'show'

    showChooseObstaclesSelectImage: (obstacle) ->
        @image_name = 'images/' + obstacle + '.png'
        @obstacles_select_image.find('.obstacle-image').attr 'src', @image_name
        @obstacles_select_image.show()

    updateObstacleSelect: (obstacles) ->
        @current_obstacles = obstacles
        @obstacles_select.val(obstacles)

    serialize: ->
        #( "#{ship.pilot.id}:#{ship.upgrades[i].data?.id ? -1 for slot, i in ship.pilot.slots}:#{ship.title?.data?.id ? -1}:#{upgrade.data?.id ? -1 for upgrade in ship.title?.conferredUpgrades ? []}:#{ship.modification?.data?.id ? -1}" for ship in @ships when ship.pilot? ).join ';'

        serialization_version = 4
        game_type_abbrev = switch @game_type_selector.val()
            when 'standard'
                's'
            when 'epic'
                'e'
            when 'team-epic'
                't'
            when 'custom'
                "c=#{$.trim @desired_points_input.val()}"
        """v#{serialization_version}!#{game_type_abbrev}!#{( ship.toSerialized() for ship in @ships when ship.pilot? ).join ';'}"""

    loadFromSerialized: (serialized) ->
        @suppress_automatic_new_ship = true
        # Clear all existing ships
        @removeAllShips()

        re = /^v(\d+)!(.*)/
        matches = re.exec serialized
        if matches?
            # versioned
            version = parseInt matches[1]
            switch version
                when 3, 4
                    # parse out game type
                    [ game_type_abbrev, serialized_ships ] = matches[2].split('!')
                    switch game_type_abbrev
                        when 's'
                            @game_type_selector.val 'standard'
                            @game_type_selector.change()
                        when 'e'
                            @game_type_selector.val 'epic'
                            @game_type_selector.change()
                        when 't'
                            @game_type_selector.val 'team-epic'
                            @game_type_selector.change()
                        else
                            @game_type_selector.val 'custom'
                            @desired_points_input.val parseInt(game_type_abbrev.split('=')[1])
                            @desired_points_input.change()
                    for serialized_ship in serialized_ships.split(';')
                        unless serialized_ship == ''
                            new_ship = @addShip()
                            new_ship.fromSerialized version, serialized_ship
                when 2
                    for serialized_ship in matches[2].split(';')
                        unless serialized_ship == ''
                            new_ship = @addShip()
                            new_ship.fromSerialized version, serialized_ship
        else
            # v1 (unversioned)
            for serialized_ship in serialized.split(';')
                unless serialized == ''
                    new_ship = @addShip()
                    new_ship.fromSerialized 1, serialized_ship

        @suppress_automatic_new_ship = false
        # Finally, the unassigned ship
        @addShip()

    uniqueIndex: (unique, type) ->
        if type not of @uniques_in_use
            throw new Error("Invalid unique type '#{type}'")
        @uniques_in_use[type].indexOf unique

    claimUnique: (unique, type, cb) =>
        if @uniqueIndex(unique, type) < 0
            # Claim pilots with the same canonical name
            for other in (exportObj.pilotsByUniqueName[unique.canonical_name.getXWSBaseName()] or [])
                if unique != other
                    if @uniqueIndex(other, 'Pilot') < 0
                        #console.log "Also claiming unique pilot #{other.canonical_name} in use"
                        @uniques_in_use['Pilot'].push other
                    else
                        throw new Error("Unique #{type} '#{unique.name}' already claimed as pilot")

            # Claim other upgrades with the same canonical name
            for otherslot, bycanonical of exportObj.upgradesBySlotUniqueName
                for canonical, other of bycanonical
                    if canonical.getXWSBaseName() == unique.canonical_name.getXWSBaseName() and unique != other
                        if @uniqueIndex(other, 'Upgrade') < 0
                            #console.log "Also claiming unique #{other.canonical_name} (#{otherslot}) in use"
                            @uniques_in_use['Upgrade'].push other
                        # else
                        #     throw new Error("Unique #{type} '#{unique.name}' already claimed as #{otherslot}")

            @uniques_in_use[type].push unique
            #console.log "Uniques in use #{JSON.stringify(@uniques_in_use)}"
        else
            throw new Error("Unique #{type} '#{unique.name}' already claimed")
        cb()

    releaseUnique: (unique, type, cb) =>
        idx = @uniqueIndex(unique, type)
        if idx >= 0
            # Release all uniques with the same canonical name and base name
            for type, uniques of @uniques_in_use
                # Removing stuff in a loop sucks, so we'll construct a new list
                @uniques_in_use[type] = []
                for u in uniques
                    if u.canonical_name.getXWSBaseName() != unique.canonical_name.getXWSBaseName()
                        # Keep this one
                        @uniques_in_use[type].push u
                    # else
                    #     console.log "Releasing #{u.name} (#{type}) with canonical name #{unique.canonical_name}"
        else
            throw new Error("Unique #{type} '#{unique.name}' not in use")
        cb()

    addShip: ->
        new_ship = new Ship
            builder: this
            container: @ship_container
        @ships.push new_ship
        new_ship


    removeShip: (ship) ->
        await ship.destroy defer()
        await @container.trigger 'xwing:pointsUpdated', defer()
        @current_squad.dirty = true
        @container.trigger 'xwing-backend:squadDirtinessChanged'

    matcher: (item, term) ->
        item.toUpperCase().indexOf(term.toUpperCase()) >= 0

    isOurFaction: (faction) ->
        if faction instanceof Array
            for f in faction
                if getPrimaryFaction(f) == @faction
                    return true
            false
        else
            getPrimaryFaction(faction) == @faction

    getAvailableShipsMatching: (term='') ->
        ships = []
        for ship_name, ship_data of exportObj.ships
            if @isOurFaction(ship_data.factions) and @matcher(ship_data.name, term)
                if not ship_data.huge or (@isEpic or @isCustom)
                    ships.push
                        id: ship_data.name
                        text: ship_data.name
                        english_name: ship_data.english_name
                        canonical_name: ship_data.canonical_name
        ships.sort exportObj.sortHelper

    getAvailablePilotsForShipIncluding: (ship, include_pilot, term='') ->
        # Returns data formatted for Select2
        available_faction_pilots = (pilot for pilot_name, pilot of exportObj.pilotsByLocalizedName when (not ship? or pilot.ship == ship) and @isOurFaction(pilot.faction) and @matcher(pilot_name, term))

        eligible_faction_pilots = (pilot for pilot_name, pilot of available_faction_pilots when (not pilot.unique? or pilot not in @uniques_in_use['Pilot'] or pilot.canonical_name.getXWSBaseName() == include_pilot?.canonical_name.getXWSBaseName()))

        # Re-add selected pilot
        if include_pilot? and include_pilot.unique? and @matcher(include_pilot.name, term)
            eligible_faction_pilots.push include_pilot
        ({ id: pilot.id, text: "#{pilot.name} (#{pilot.points})", points: pilot.points, ship: pilot.ship, english_name: pilot.english_name, disabled: pilot not in eligible_faction_pilots } for pilot in available_faction_pilots).sort exportObj.sortHelper

    dfl_filter_func = ->
        true

    getAvailableUpgradesIncluding: (slot, include_upgrade, ship, this_upgrade_obj, term='', filter_func=@dfl_filter_func) ->
        # Returns data formatted for Select2
        limited_upgrades_in_use = (upgrade.data for upgrade in ship.upgrades when upgrade?.data?.limited?)

        available_upgrades = (upgrade for upgrade_name, upgrade of exportObj.upgradesByLocalizedName when upgrade.slot == slot and @matcher(upgrade_name, term) and (not upgrade.ship? or upgrade.ship == ship.data.name) and (not upgrade.faction? or @isOurFaction(upgrade.faction)) and ((@isEpic or @isCustom) or upgrade.restriction_func != exportObj.hugeOnly))

        if filter_func != @dfl_filter_func
            available_upgrades = (upgrade for upgrade in available_upgrades when filter_func(upgrade))

        # Special case #3
        # Ordnance tube hack
        if (@isEpic or @isCustom) and slot == 'Hardpoint' and 'Ordnance Tubes'.canonicalize() in (m.data.canonical_name.getXWSBaseName() for m in ship.modifications when m.data?)
            available_upgrades = available_upgrades.concat (upgrade for upgrade_name, upgrade of exportObj.upgradesByLocalizedName when upgrade.slot in ['Missile', 'Torpedo'] and @matcher(upgrade_name, term) and (not upgrade.ship? or upgrade.ship == ship.data.name) and (not upgrade.faction? or @isOurFaction(upgrade.faction)) and ((@isEpic or @isCustom) or upgrade.restriction_func != exportObj.hugeOnly))

        eligible_upgrades = (upgrade for upgrade_name, upgrade of available_upgrades when (not upgrade.unique? or upgrade not in @uniques_in_use['Upgrade']) and (not (ship? and upgrade.restriction_func?) or upgrade.restriction_func(ship, this_upgrade_obj)) and upgrade not in limited_upgrades_in_use)

        # Special case #2 :(
        # current_upgrade_forcibly_removed = false
        for title in ship?.titles ? []
            if title?.data?.special_case == 'A-Wing Test Pilot'
                for equipped_upgrade in (upgrade.data for upgrade in ship.upgrades when upgrade?.data?)
                    eligible_upgrades.removeItem equipped_upgrade
                    # current_upgrade_forcibly_removed = true if equipped_upgrade == include_upgrade

        # Re-enable selected upgrade
        if include_upgrade? and (((include_upgrade.unique? or include_upgrade.limited?) and @matcher(include_upgrade.name, term)))# or current_upgrade_forcibly_removed)
            # available_upgrades.push include_upgrade
            eligible_upgrades.push include_upgrade
        retval = ({ id: upgrade.id, text: "#{upgrade.name} (#{upgrade.points})", points: upgrade.points, english_name: upgrade.english_name, disabled: upgrade not in eligible_upgrades } for upgrade in available_upgrades).sort exportObj.sortHelper
        # Possibly adjust the upgrade
        if this_upgrade_obj.adjustment_func?
            (this_upgrade_obj.adjustment_func(upgrade) for upgrade in retval)
        else
            retval

    getAvailableModificationsIncluding: (include_modification, ship, term='', filter_func=@dfl_filter_func) ->
        # Returns data formatted for Select2
        limited_modifications_in_use = (modification.data for modification in ship.modifications when modification?.data?.limited?)

        available_modifications = (modification for modification_name, modification of exportObj.modificationsByLocalizedName when @matcher(modification_name, term) and (not modification.ship? or modification.ship == ship.data.name))

        if filter_func != @dfl_filter_func
            available_modifications = (modification for modification in available_modifications when filter_func(modification))

        if ship? and exportObj.hugeOnly(ship) > 0
            # Only show allowed mods for Epic ships
            available_modifications = (modification for modification in available_modifications when modification.ship? or not modification.restriction_func? or modification.restriction_func ship)

        eligible_modifications = (modification for modification_name, modification of available_modifications when (not modification.unique? or modification not in @uniques_in_use['Modification']) and (not modification.faction? or @isOurFaction(modification.faction)) and (not (ship? and modification.restriction_func?) or modification.restriction_func ship) and modification not in limited_modifications_in_use)

        # I finally had to add a special case :(  If something else demands it
        # then I will try to make this more systematic, but I haven't come up
        # with a good solution... yet.
        # current_mod_forcibly_removed = false
        for title in ship?.titles ? []
            if title?.data?.special_case == 'Royal Guard TIE'
                # Need to refetch by ID because Vaksai may have modified its cost
                for equipped_modification in (modificationsById[modification.data.id] for modification in ship.modifications when modification?.data?)
                    eligible_modifications.removeItem equipped_modification
                    # current_mod_forcibly_removed = true if equipped_modification == include_modification

        # Re-add selected modification
        if include_modification? and (((include_modification.unique? or include_modification.limited?) and @matcher(include_modification.name, term)))# or current_mod_forcibly_removed)
            eligible_modifications.push include_modification
        ({ id: modification.id, text: "#{modification.name} (#{modification.points})", points: modification.points, english_name: modification.english_name, disabled: modification not in eligible_modifications } for modification in available_modifications).sort exportObj.sortHelper

    getAvailableTitlesIncluding: (ship, include_title, term='') ->
        # Returns data formatted for Select2
        # Titles are no longer unique!
        limited_titles_in_use = (title.data for title in ship.titles when title?.data?.limited?)
        available_titles = (title for title_name, title of exportObj.titlesByLocalizedName when (not title.ship? or title.ship == ship.data.name) and @matcher(title_name, term))

        eligible_titles = (title for title_name, title of available_titles when (not title.unique? or (title not in @uniques_in_use['Title'] and title.canonical_name.getXWSBaseName() not in (t.canonical_name.getXWSBaseName() for t in @uniques_in_use['Title'])) or title.canonical_name.getXWSBaseName() == include_title?.canonical_name.getXWSBaseName()) and (not title.faction? or @isOurFaction(title.faction)) and (not (ship? and title.restriction_func?) or title.restriction_func ship) and title not in limited_titles_in_use)

        # Re-add selected title
        if include_title? and (((include_title.unique? or include_title.limited?) and @matcher(include_title.name, term)))
            eligible_titles.push include_title
        ({ id: title.id, text: "#{title.name} (#{title.points})", points: title.points, english_name: title.english_name, disabled: title not in eligible_titles } for title in available_titles).sort exportObj.sortHelper

    # Converts a maneuver table for into an HTML table.
    getManeuverTableHTML: (maneuvers, baseManeuvers) ->
        if not maneuvers? or maneuvers.length == 0
            return "Missing maneuver info."

        # Preprocess maneuvers to see which bearings are never used so we
        # don't render them.
        bearings_without_maneuvers = [0...maneuvers[0].length]
        for bearings in maneuvers
            for difficulty, bearing in bearings
                if difficulty > 0
                    bearings_without_maneuvers.removeItem bearing
        # console.log "bearings without maneuvers:"
        # console.dir bearings_without_maneuvers

        outTable = "<table><tbody>"

        for speed in [maneuvers.length - 1 .. 0]

            haveManeuver = false
            for v in maneuvers[speed]
                if v > 0
                    haveManeuver = true
                    break

            continue if not haveManeuver

            outTable += "<tr><td>#{speed}</td>"
            for turn in [0 ... maneuvers[speed].length]
                continue if turn in bearings_without_maneuvers

                outTable += "<td>"
                if maneuvers[speed][turn] > 0

                    color = switch maneuvers[speed][turn]
                        when 1 then "white"
                        when 2 then "green"
                        when 3 then "red"

                    outTable += """<svg xmlns="http://www.w3.org/2000/svg" width="30px" height="30px" viewBox="0 0 200 200">"""

                    if speed == 0
                        outTable += """<rect x="50" y="50" width="100" height="100" style="fill:#{color}" />"""
                    else

                        outlineColor = "black"
                        if maneuvers[speed][turn] != baseManeuvers[speed][turn]
                            outlineColor = "gold" # highlight manuevers modified by another card (e.g. R2 Astromech makes all 1 & 2 speed maneuvers green)

                        transform = ""
                        className = ""
                        switch turn
                            when 0
                                # turn left
                                linePath = "M160,180 L160,70 80,70"
                                trianglePath = "M80,100 V40 L30,70 Z"
                            when 1
                                # bank left
                                linePath = "M150,180 S150,120 80,60"
                                trianglePath = "M80,100 V40 L30,70 Z"
                                transform = "transform='translate(-5 -15) rotate(45 70 90)' "
                            when 2
                                # straight
                                linePath = "M100,180 L100,100 100,80"
                                trianglePath = "M70,80 H130 L100,30 Z"
                            when 3
                                # bank right
                                linePath = "M50,180 S50,120 120,60"
                                trianglePath = "M120,100 V40 L170,70 Z"
                                transform = "transform='translate(5 -15) rotate(-45 130 90)' "
                            when 4
                                # turn right
                                linePath = "M40,180 L40,70 120,70"
                                trianglePath = "M120,100 V40 L170,70 Z"
                            when 5
                                # k-turn/u-turn
                                linePath = "M50,180 L50,100 C50,10 140,10 140,100 L140,120"
                                trianglePath = "M170,120 H110 L140,180 Z"
                            when 6
                                # segnor's loop left
                                linePath = "M150,180 S150,120 80,60"
                                trianglePath = "M80,100 V40 L30,70 Z"
                                transform = "transform='translate(0 50)'"
                            when 7
                                # segnor's loop right
                                linePath = "M50,180 S50,120 120,60"
                                trianglePath = "M120,100 V40 L170,70 Z"
                                transform = "transform='translate(0 50)'"
                            when 8
                                # tallon roll left
                                linePath = "M160,180 L160,70 80,70"
                                trianglePath = "M60,100 H100 L80,140 Z"
                            when 9
                                # tallon roll right
                                linePath = "M40,180 L40,70 120,70"
                                trianglePath = "M100,100 H140 L120,140 Z"
                            when 10
                                # backward left
                                linePath = "M50,180 S50,120 120,60"
                                trianglePath = "M120,100 V40 L170,70 Z"
                                transform = "transform='translate(5 -15) rotate(-45 130 90)' "
                                className = 'backwards'
                            when 11
                                # backward straight
                                linePath = "M100,180 L100,100 100,80"
                                trianglePath = "M70,80 H130 L100,30 Z"
                                className = 'backwards'
                            when 12
                                # backward right
                                linePath = "M150,180 S150,120 80,60"
                                trianglePath = "M80,100 V40 L30,70 Z"
                                transform = "transform='translate(-5 -15) rotate(45 70 90)' "
                                className = 'backwards'

                        outTable += $.trim """
                          <g class="maneuver #{className}">
                            <path d='#{trianglePath}' fill='#{color}' stroke-width='5' stroke='#{outlineColor}' #{transform}/>
                            <path stroke-width='25' fill='none' stroke='#{outlineColor}' d='#{linePath}' />
                            <path stroke-width='15' fill='none' stroke='#{color}' d='#{linePath}' />
                          </g>
                        """

                    outTable += "</svg>"
                outTable += "</td>"
            outTable += "</tr>"
        outTable += "</tbody></table>"
        outTable

    showTooltip: (type, data, additional_opts) ->
        if data != @tooltip_currently_displaying
            switch type
                when 'Ship'
                    @info_container.find('.info-sources').text (exportObj.translate(@language, 'sources', source) for source in data.pilot.sources).sort().join(', ')
                    if @collection?.counts?
                        ship_count = @collection.counts?.ship?[data.data.english_name] ? 0
                        pilot_count = @collection.counts?.pilot?[data.pilot.english_name] ? 0
                        @info_container.find('.info-collection').text """You have #{ship_count} ship model#{if ship_count > 1 then 's' else ''} and #{pilot_count} pilot card#{if pilot_count > 1 then 's' else ''} in your collection."""
                    else
                        @info_container.find('.info-collection').text ''
                    effective_stats = data.effectiveStats()
                    extra_actions = $.grep effective_stats.actions, (el, i) ->
                        el not in data.data.actions
                    @info_container.find('.info-name').html """#{if data.pilot.unique then "&middot;&nbsp;" else ""}#{data.pilot.name}#{if data.pilot.epic? then " (#{exportObj.translate(@language, 'ui', 'epic')})" else ""}#{if exportObj.isReleased(data.pilot) then "" else " (#{exportObj.translate(@language, 'ui', 'unreleased')})"}"""
                    @info_container.find('p.info-text').html data.pilot.text ? ''
                    @info_container.find('tr.info-ship td.info-data').text data.pilot.ship
                    @info_container.find('tr.info-ship').show()
                    @info_container.find('tr.info-skill td.info-data').text statAndEffectiveStat(data.pilot.skill, effective_stats, 'skill')
                    @info_container.find('tr.info-skill').show()

                    for cls in @info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font')[0].classList
                        @info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').removeClass(cls) if cls.startsWith('xwing-miniatures-font-attack')
                    @info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').addClass(data.data.attack_icon ? 'xwing-miniatures-font-attack')

                    @info_container.find('tr.info-attack td.info-data').text statAndEffectiveStat((data.pilot.ship_override?.attack ? data.data.attack), effective_stats, 'attack')
                    @info_container.find('tr.info-attack').toggle(data.pilot.ship_override?.attack? or data.data.attack?)
                    @info_container.find('tr.info-energy td.info-data').text statAndEffectiveStat((data.pilot.ship_override?.energy ? data.data.energy), effective_stats, 'energy')
                    @info_container.find('tr.info-energy').toggle(data.pilot.ship_override?.energy? or data.data.energy?)
                    @info_container.find('tr.info-range').hide()
                    @info_container.find('tr.info-agility td.info-data').text statAndEffectiveStat((data.pilot.ship_override?.agility ? data.data.agility), effective_stats, 'agility')
                    @info_container.find('tr.info-agility').show()
                    @info_container.find('tr.info-hull td.info-data').text statAndEffectiveStat((data.pilot.ship_override?.hull ? data.data.hull), effective_stats, 'hull')
                    @info_container.find('tr.info-hull').show()
                    @info_container.find('tr.info-shields td.info-data').text statAndEffectiveStat((data.pilot.ship_override?.shields ? data.data.shields), effective_stats, 'shields')
                    @info_container.find('tr.info-shields').show()
                    @info_container.find('tr.info-actions td.info-data').html (exportObj.translate(@language, 'action', a) for a in data.data.actions.concat( ("<strong>#{exportObj.translate @language, 'action', action}</strong>" for action in extra_actions))).join ', '
                    @info_container.find('tr.info-actions').show()
                    @info_container.find('tr.info-upgrades').show()
                    @info_container.find('tr.info-upgrades td.info-data').text((exportObj.translate(@language, 'slot', slot) for slot in data.pilot.slots).join(', ') or 'None')
                    @info_container.find('p.info-maneuvers').show()
                    @info_container.find('p.info-maneuvers').html(@getManeuverTableHTML(effective_stats.maneuvers, data.data.maneuvers))
                when 'Pilot'
                    @info_container.find('.info-sources').text (exportObj.translate(@language, 'sources', source) for source in data.sources).sort().join(', ')
                    if @collection?.counts?
                        pilot_count = @collection.counts?.pilot?[data.english_name] ? 0
                        ship_count = @collection.counts.ship?[additional_opts.ship] ? 0
                        @info_container.find('.info-collection').text """You have #{ship_count} ship model#{if ship_count > 1 then 's' else ''} and #{pilot_count} pilot card#{if pilot_count > 1 then 's' else ''} in your collection."""
                    else
                        @info_container.find('.info-collection').text ''
                    @info_container.find('.info-name').html """#{if data.unique then "&middot;&nbsp;" else ""}#{data.name}#{if data.epic? then " (#{exportObj.translate(@language, 'ui', 'epic')})" else ""}#{if exportObj.isReleased(data) then "" else " (#{exportObj.translate(@language, 'ui', 'unreleased')})"}"""
                    @info_container.find('p.info-text').html data.text ? ''
                    ship = exportObj.ships[data.ship]
                    @info_container.find('tr.info-ship td.info-data').text data.ship
                    @info_container.find('tr.info-ship').show()
                    @info_container.find('tr.info-skill td.info-data').text data.skill
                    @info_container.find('tr.info-skill').show()
                    @info_container.find('tr.info-attack td.info-data').text(data.ship_override?.attack ? ship.attack)
                    @info_container.find('tr.info-attack').toggle(data.ship_override?.attack? or ship.attack?)

                    for cls in @info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font')[0].classList
                        @info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').removeClass(cls) if cls.startsWith('xwing-miniatures-font-attack')
                    @info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').addClass(ship.attack_icon ? 'xwing-miniatures-font-attack')

                    @info_container.find('tr.info-energy td.info-data').text(data.ship_override?.energy ? ship.energy)
                    @info_container.find('tr.info-energy').toggle(data.ship_override?.energy? or ship.energy?)
                    @info_container.find('tr.info-range').hide()
                    @info_container.find('tr.info-agility td.info-data').text(data.ship_override?.agility ? ship.agility)
                    @info_container.find('tr.info-agility').show()
                    @info_container.find('tr.info-hull td.info-data').text(data.ship_override?.hull ? ship.hull)
                    @info_container.find('tr.info-hull').show()
                    @info_container.find('tr.info-shields td.info-data').text(data.ship_override?.shields ? ship.shields)
                    @info_container.find('tr.info-shields').show()
                    @info_container.find('tr.info-actions td.info-data').text (exportObj.translate(@language, 'action', action) for action in (data.ship_override?.actions ? exportObj.ships[data.ship].actions)).join(', ')
                    @info_container.find('tr.info-actions').show()
                    @info_container.find('tr.info-upgrades').show()
                    @info_container.find('tr.info-upgrades td.info-data').text((exportObj.translate(@language, 'slot', slot) for slot in data.slots).join(', ') or 'None')
                    @info_container.find('p.info-maneuvers').show()
                    @info_container.find('p.info-maneuvers').html(@getManeuverTableHTML(ship.maneuvers, ship.maneuvers))
                when 'Addon'
                    @info_container.find('.info-sources').text (exportObj.translate(@language, 'sources', source) for source in data.sources).sort().join(', ')
                    if @collection?.counts?
                        addon_count = @collection.counts?[additional_opts.addon_type.toLowerCase()]?[data.english_name] ? 0
                        @info_container.find('.info-collection').text """You have #{addon_count} in your collection."""
                    else
                        @info_container.find('.info-collection').text ''
                    @info_container.find('.info-name').html """#{if data.unique then "&middot;&nbsp;" else ""}#{data.name}#{if data.limited? then " (#{exportObj.translate(@language, 'ui', 'limited')})" else ""}#{if data.epic? then " (#{exportObj.translate(@language, 'ui', 'epic')})" else ""}#{if exportObj.isReleased(data) then  "" else " (#{exportObj.translate(@language, 'ui', 'unreleased')})"}"""
                    @info_container.find('p.info-text').html data.text ? ''
                    @info_container.find('tr.info-ship').hide()
                    @info_container.find('tr.info-skill').hide()
                    if data.energy?
                        @info_container.find('tr.info-energy td.info-data').text data.energy
                        @info_container.find('tr.info-energy').show()
                    else
                        @info_container.find('tr.info-energy').hide()
                    if data.attack?
                        # Attack icons on upgrade cards don't get special icons
                        for cls in @info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font')[0].classList
                            @info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').removeClass(cls) if cls.startsWith('xwing-miniatures-font-attack')
                        @info_container.find('tr.info-attack td.info-header i.xwing-miniatures-font').addClass('xwing-miniatures-font-attack')
                        @info_container.find('tr.info-attack td.info-data').text data.attack
                        @info_container.find('tr.info-attack').show()
                    else
                        @info_container.find('tr.info-attack').hide()
                    if data.range?
                        @info_container.find('tr.info-range td.info-data').text data.range
                        @info_container.find('tr.info-range').show()
                    else
                        @info_container.find('tr.info-range').hide()
                    @info_container.find('tr.info-agility').hide()
                    @info_container.find('tr.info-hull').hide()
                    @info_container.find('tr.info-shields').hide()
                    @info_container.find('tr.info-actions').hide()
                    @info_container.find('tr.info-upgrades').hide()
                    @info_container.find('p.info-maneuvers').hide()
            @info_container.show()
            @tooltip_currently_displaying = data

    _randomizerLoopBody: (data) =>
        if data.keep_running and data.iterations < data.max_iterations
            data.iterations++
            #console.log "Current points: #{@total_points} of #{data.max_points}, iteration=#{data.iterations} of #{data.max_iterations}, keep_running=#{data.keep_running}"
            if @total_points == data.max_points
                # Exact hit!
                #console.log "Points reached exactly"
                data.keep_running = false
            else if @total_points < data.max_points
                #console.log "Need to add something"
                # Add something
                # Possible options: ship or empty addon slot
                unused_addons = []
                for ship in @ships
                    for upgrade in ship.upgrades
                        unused_addons.push upgrade unless upgrade.data?
                    unused_addons.push ship.title if ship.title? and not ship.title.data?
                    for modification in ship.modifications
                        unused_addons.push modification unless modification.data?
                # 0 is ship, otherwise addon
                idx = $.randomInt(1 + unused_addons.length)
                if idx == 0
                    # Add random ship
                    #console.log "Add ship"
                    available_ships = @getAvailableShipsMatching()
                    ship_type = available_ships[$.randomInt available_ships.length].text
                    available_pilots = @getAvailablePilotsForShipIncluding(ship_type)
                    pilot = available_pilots[$.randomInt available_pilots.length]
                    if exportObj.pilotsById[pilot.id].sources.intersects(data.allowed_sources)
                        new_ship = @addShip()
                        new_ship.setPilotById pilot.id
                else
                    # Add upgrade/title/modification
                    #console.log "Add addon"
                    addon = unused_addons[idx - 1]
                    switch addon.type
                        when 'Upgrade'
                            available_upgrades = (upgrade for upgrade in @getAvailableUpgradesIncluding(addon.slot, null, addon.ship) when exportObj.upgradesById[upgrade.id].sources.intersects(data.allowed_sources))
                            addon.setById available_upgrades[$.randomInt available_upgrades.length].id if available_upgrades.length > 0
                        when 'Title'
                            available_titles = (title for title in @getAvailableTitlesIncluding(addon.ship) when exportObj.titlesById[title.id].sources.intersects(data.allowed_sources))
                            addon.setById available_titles[$.randomInt available_titles.length].id if available_titles.length > 0
                        when 'Modification'
                            available_modifications = (modification for modification in @getAvailableModificationsIncluding(null, addon.ship) when exportObj.modificationsById[modification.id].sources.intersects(data.allowed_sources))
                            addon.setById available_modifications[$.randomInt available_modifications.length].id if available_modifications.length > 0
                        else
                            throw new Error("Invalid addon type #{addon.type}")

            else
                #console.log "Need to remove something"
                # Remove something
                removable_things = []
                for ship in @ships
                    removable_things.push ship
                    for upgrade in ship.upgrades
                        removable_things.push upgrade if upgrade.data?
                    removable_things.push ship.title if ship.title?.data?
                    removable_things.push ship.modification if ship.modification?.data?
                if removable_things.length > 0
                    thing_to_remove = removable_things[$.randomInt removable_things.length]
                    #console.log "Removing #{thing_to_remove}"
                    if thing_to_remove instanceof Ship
                        @removeShip thing_to_remove
                    else if thing_to_remove instanceof GenericAddon
                        thing_to_remove.setData null
                    else
                        throw new Error("Unknown thing to remove #{thing_to_remove}")
            # continue the "loop"
            window.setTimeout @_makeRandomizerLoopFunc(data), 0
        else
            #console.log "Clearing timer #{data.timer}, iterations=#{data.iterations}, keep_running=#{data.keep_running}"
            window.clearTimeout data.timer
            # Update all selectors
            for ship in @ships
                ship.updateSelections()
            @suppress_automatic_new_ship = false
            @addShip()

    _makeRandomizerLoopFunc: (data) =>
        () =>
            @_randomizerLoopBody(data)

    randomSquad: (max_points=100, allowed_sources=null, timeout_ms=1000, max_iterations=1000) ->
        @backend_status.fadeOut 'slow'
        @suppress_automatic_new_ship = true
        # Clear all existing ships
        while @ships.length > 0
            @removeShip @ships[0]
        throw new Error("Ships not emptied") if @ships.length > 0
        data =
            iterations: 0
            max_points: max_points
            max_iterations: max_iterations
            keep_running: true
            allowed_sources: allowed_sources ? exportObj.expansions
        stopHandler = () =>
            #console.log "*** TIMEOUT *** TIMEOUT *** TIMEOUT ***"
            data.keep_running = false
        data.timer = window.setTimeout stopHandler , timeout_ms
        #console.log "Timer set for #{timeout_ms}ms, timer is #{data.timer}"
        window.setTimeout @_makeRandomizerLoopFunc(data), 0
        @resetCurrentSquad()
        @current_squad.name = 'Random Squad'
        @container.trigger 'xwing-backend:squadNameChanged'

    setBackend: (backend) ->
        @backend = backend

    describeSquad: ->
        (ship.pilot.name for ship in @ships when ship.pilot?).join ', '

    listCards: ->
        card_obj = {}
        for ship in @ships
            if ship.pilot?
                card_obj[ship.pilot.name] = null
                for upgrade in ship.upgrades
                    card_obj[upgrade.data.name] = null if upgrade.data?
                card_obj[ship.title.data.name] = null if ship.title?.data?
                card_obj[ship.modification.data.name] = null if ship.modification?.data?
        return Object.keys(card_obj).sort()

    getNotes: ->
        @notes.val()

    getObstacles: ->
        @current_obstacles

    isSquadPossibleWithCollection: ->
        # console.log "#{@faction}: isSquadPossibleWithCollection()"
        # If the collection is uninitialized or empty, don't actually check it.
        if Object.keys(@collection?.expansions ? {}).length == 0
            # console.log "collection not ready or is empty"
            return true
        @collection.reset()
        validity = true
        for ship in @ships
            if ship.pilot?
                # Try to get both the physical model and the pilot card.
                ship_is_available = @collection.use('ship', ship.pilot.english_ship)
                pilot_is_available = @collection.use('pilot', ship.pilot.english_name)
                # console.log "#{@faction}: Ship #{ship.pilot.english_ship} available: #{ship_is_available}"
                # console.log "#{@faction}: Pilot #{ship.pilot.english_name} available: #{pilot_is_available}"
                validity = false unless ship_is_available and pilot_is_available
                for upgrade in ship.upgrades
                    if upgrade.data?
                        upgrade_is_available = @collection.use('upgrade', upgrade.data.english_name)
                        # console.log "#{@faction}: Upgrade #{upgrade.data.english_name} available: #{upgrade_is_available}"
                        validity = false unless upgrade_is_available
                for modification in ship.modifications
                    if modification.data?
                        modification_is_available = @collection.use('modification', modification.data.english_name)
                        # console.log "#{@faction}: Modification #{modification.data.english_name} available: #{modification_is_available}"
                        validity = false unless modification_is_available
                for title in ship.titles
                    if title?.data?
                        title_is_available = @collection.use('title', title.data.english_name)
                        # console.log "#{@faction}: Title #{title.data.english_name} available: #{title_is_available}"
                        validity = false unless title_is_available
        validity

    checkCollection: ->
        # console.log "#{@faction}: Checking validity of squad against collection..."
        if @collection?
            @collection_invalid_container.toggleClass 'hidden', @isSquadPossibleWithCollection()

    toXWS: ->
        # Often you will want JSON.stringify(builder.toXWS())
        xws =
            description: @getNotes()
            faction: exportObj.toXWSFaction[@faction]
            name: @current_squad.name
            pilots: []
            points: @total_points
            vendor:
                yasb:
                    builder: '(Yet Another) X-Wing Miniatures Squad Builder'
                    builder_url: window.location.href.split('?')[0]
                    link: @getPermaLink()
            version: '0.3.0'

        for ship in @ships
            if ship.pilot?
                xws.pilots.push ship.toXWS()

        # Associate multisection ships
        # This maps id to list of pilots it comprises
        multisection_id_to_pilots = {}
        last_id = 0
        unmatched = (pilot for pilot in xws.pilots when pilot.multisection?)
        for _ in [0...(unmatched.length ** 2)]
            break if unmatched.length == 0
            # console.log "Top of loop, unmatched: #{m.name for m in unmatched}"
            unmatched_pilot = unmatched.shift()
            unmatched_pilot.multisection_id ?= last_id++
            multisection_id_to_pilots[unmatched_pilot.multisection_id] ?= [unmatched_pilot]
            break if unmatched.length == 0
            # console.log "Finding matches for #{unmatched_pilot.name} (assigned id=#{unmatched_pilot.multisection_id})"
            matches = []
            for candidate in unmatched
                # console.log "-> examine #{candidate.name}"
                if unmatched_pilot.name in candidate.multisection
                    matches.push candidate
                    unmatched_pilot.multisection.removeItem candidate.name
                    candidate.multisection.removeItem unmatched_pilot.name
                    candidate.multisection_id = unmatched_pilot.multisection_id
                    # console.log "-> MATCH FOUND #{candidate.name}, assigned id=#{candidate.multisection_id}"
                    multisection_id_to_pilots[candidate.multisection_id].push candidate
                    if unmatched_pilot.multisection.length == 0
                        # console.log "-> No more sections to match for #{unmatched_pilot.name}"
                        break
            for match in matches
                if match.multisection.length == 0
                    # console.log "Dequeue #{match.name} since it has no more sections to match"
                    unmatched.removeItem match

        for pilot in xws.pilots
            delete pilot.multisection if pilot.multisection?

        obstacles = @getObstacles()
        if obstacles? and obstacles.length > 0
            xws.obstacles = obstacles

        xws

    toMinimalXWS: ->
        # Just what's necessary
        xws = @toXWS()

        # Keep mandatory stuff only
        for own k, v of xws
            delete xws[k] unless k in ['faction', 'pilots', 'version']

        for own k, v of xws.pilots
            delete xws[k] unless k in ['name', 'ship', 'upgrades', 'multisection_id']

        xws

    loadFromXWS: (xws, cb) ->
        success = null
        error = null

        version_list = (parseInt x for x in xws.version.split('.'))

        switch
            # Not doing backward compatibility pre-1.x
            when version_list > [0, 1]
                xws_faction = exportObj.fromXWSFaction[xws.faction]

                if @faction != xws_faction
                        throw new Error("Attempted to load XWS for #{xws.faction} but builder is #{@faction}")

                if xws.name?
                    @current_squad.name = xws.name
                if xws.description?
                    @notes.val xws.description

                if xws.obstacles?
                    @current_squad.additional_data.obstacles = xws.obstacles

                @suppress_automatic_new_ship = true
                @removeAllShips()

                for pilot in xws.pilots
                    new_ship = @addShip()
                    try
                        new_ship.setPilot (p for p in exportObj.pilotsByFactionCanonicalName[@faction][pilot.name] when p.ship.canonicalize() == pilot.ship)[0]
                    catch err
                        # console.error err.message
                        continue
                    # Turn all the upgrades into a flat list so we can keep trying to add them
                    addons = []
                    for upgrade_type, upgrade_canonicals of pilot.upgrades ? {}
                        for upgrade_canonical in upgrade_canonicals
                            # console.log upgrade_type, upgrade_canonical
                            slot = null
                            yasb_upgrade_type = exportObj.fromXWSUpgrade[upgrade_type] ? upgrade_type.capitalize()
                            addon = switch yasb_upgrade_type
                                when 'Modification'
                                    exportObj.modificationsByCanonicalName[upgrade_canonical]
                                when 'Title'
                                    exportObj.titlesByCanonicalName[upgrade_canonical]
                                else
                                    slot = yasb_upgrade_type
                                    exportObj.upgradesBySlotCanonicalName[slot][upgrade_canonical]
                            if addon?
                                # console.log "-> #{upgrade_type} #{addon.name} #{slot}"
                                addons.push
                                    type: yasb_upgrade_type
                                    data: addon
                                    slot: slot

                    if addons.length > 0
                        for _ in [0...1000]
                            # Try to add an addon.  If it's not eligible, requeue it and
                            # try it again later, as another addon might allow it.
                            addon = addons.shift()
                            # console.log "Adding #{addon.data.name} to #{new_ship}..."

                            addon_added = false
                            switch addon.type
                                when 'Modification'
                                    for modification in new_ship.modifications
                                        continue if modification.data?
                                        modification.setData addon.data
                                        addon_added = true
                                        break
                                when 'Title'
                                    for title in new_ship.titles
                                        continue if title.data?
                                        # Special cases :(
                                        if addon.data instanceof Array
                                            # Right now, the only time this happens is because of
                                            # Heavy Scyk.  Check the rest of the pending addons for torp,
                                            # cannon, or missiles.  Otherwise, it doesn't really matter.
                                            slot_guesses = (a.data.slot for a in addons when a.data.slot in ['Cannon', 'Missile', 'Torpedo'])
                                            # console.log slot_guesses
                                            if slot_guesses.length > 0
                                                # console.log "Guessing #{slot_guesses[0]}"
                                                title.setData exportObj.titlesByLocalizedName[""""Heavy Scyk" Interceptor (#{slot_guesses[0]})"""]
                                            else
                                                # console.log "No idea, setting to #{addon.data[0].name}"
                                                title.setData addon.data[0]
                                        else
                                            title.setData addon.data
                                        addon_added = true
                                else
                                    # console.log "Looking for unused #{addon.slot} in #{new_ship}..."
                                    for upgrade, i in new_ship.upgrades
                                        continue if upgrade.slot != addon.slot or upgrade.data?
                                        upgrade.setData addon.data
                                        addon_added = true
                                        break

                            if addon_added
                                # console.log "Successfully added #{addon.data.name} to #{new_ship}"
                                if addons.length == 0
                                    # console.log "Done with addons for #{new_ship}"
                                    break
                            else
                                # Can't add it, requeue unless there are no other addons to add
                                # in which case this isn't valid
                                if addons.length == 0
                                    success = false
                                    error = "Could not add #{addon.data.name} to #{new_ship}"
                                    break
                                else
                                    # console.log "Could not add #{addon.data.name} to #{new_ship}, trying later"
                                    addons.push addon

                        if addons.length > 0
                            success = false
                            error = "Could not add all upgrades"
                            break

                @suppress_automatic_new_ship = false
                # Finally, the unassigned ship
                @addShip()

                success = true
            else
                success = false
                error = "Invalid or unsupported XWS version"

        if success
            @current_squad.dirty = true
            @container.trigger 'xwing-backend:squadNameChanged'
            @container.trigger 'xwing-backend:squadDirtinessChanged'

        # console.log "success: #{success}, error: #{error}"

        cb
            success: success
            error: error

class Ship
    constructor: (args) ->
        # args
        @builder = args.builder
        @container = args.container

        # internal state
        @pilot = null
        @data = null # ship data
        @upgrades = []
        @modifications = []
        @titles = []

        @setupUI()

    destroy: (cb) ->
        @resetPilot()
        @resetAddons()
        @teardownUI()
        idx = @builder.ships.indexOf this
        if idx < 0
            throw new Error("Ship not registered with builder")
        @builder.ships.splice idx, 1
        cb()

    copyFrom: (other) ->
        throw new Error("Cannot copy from self") if other is this
        #console.log "Attempt to copy #{other?.pilot?.name}"
        return unless other.pilot? and other.data?
        #console.log "Setting pilot to ID=#{other.pilot.id}"
        if other.pilot.unique
            # Look for cheapest generic or available unique, otherwise do nothing
            available_pilots = (pilot_data for pilot_data in @builder.getAvailablePilotsForShipIncluding(other.data.name) when not pilot_data.disabled)
            if available_pilots.length > 0
                @setPilotById available_pilots[0].id
                # Can't just copy upgrades since slots may be different
                # Similar to setPilot() when ship is the same

                other_upgrades = {}
                for upgrade in other.upgrades
                    if upgrade?.data? and not upgrade.data.unique
                        other_upgrades[upgrade.slot] ?= []
                        other_upgrades[upgrade.slot].push upgrade

                other_modifications = []
                for modification in other.modifications
                    if modification?.data? and not modification.data.unique
                        other_modifications.push modification

                other_titles = []
                for title in other.titles
                    if title?.data? and not title.data.unique
                        other_titles.push title

                for title in @titles
                    other_title = other_titles.shift()
                    if other_title?
                        title.setById other_title.data.id

                for modification in @modifications
                    other_modification = other_modifications.shift()
                    if other_modification?
                        modification.setById other_modification.data.id

                for upgrade in @upgrades
                    other_upgrade = (other_upgrades[upgrade.slot] ? []).shift()
                    if other_upgrade?
                        upgrade.setById other_upgrade.data.id
            else
                return
        else
            # Exact clone, so we can copy things over directly
            @setPilotById other.pilot.id

            # set up non-conferred addons
            other_conferred_addons = []
            other_conferred_addons = other_conferred_addons.concat(other.titles[0].conferredAddons) if other.titles[0]?.data? # and other.titles.conferredAddons.length > 0
            other_conferred_addons = other_conferred_addons.concat(other.modifications[0].conferredAddons) if other.modifications[0]?.data?
            #console.log "Looking for conferred upgrades..."
            for other_upgrade, i in other.upgrades
                #console.log "Examining upgrade #{other_upgrade}"
                if other_upgrade.data? and other_upgrade not in other_conferred_addons and not other_upgrade.data.unique and i < @upgrades.length
                    #console.log "Copying non-unique upgrade #{other_upgrade} into slot #{i}"
                    @upgrades[i].setById other_upgrade.data.id
            #console.log "Checking other ship base title #{other.title ? null}"
            @titles[0].setById other.titles[0].data.id if other.titles[0]?.data? and not other.titles[0].data.unique
            #console.log "Checking other ship base modification #{other.modifications[0] ? null}"
            @modifications[0].setById other.modifications[0].data.id if other.modifications[0]?.data and not other.modifications[0].data.unique

            # set up conferred non-unique addons
            #console.log "Attempt to copy conferred addons..."
            if other.titles[0]? and other.titles[0].conferredAddons.length > 0
                #console.log "Other ship title #{other.titles[0]} confers addons"
                for other_conferred_addon, i in other.titles[0].conferredAddons
                    @titles[0].conferredAddons[i].setById other_conferred_addon.data.id if other_conferred_addon.data? and not other_conferred_addon.data?.unique
            if other.modifications[0]? and other.modifications[0].conferredAddons.length > 0
                #console.log "Other ship base modification #{other.modifications[0]} confers addons"
                for other_conferred_addon, i in other.modifications[0].conferredAddons
                    @modifications[0].conferredAddons[i].setById other_conferred_addon.data.id if other_conferred_addon.data? and not other_conferred_addon.data?.unique

        @updateSelections()
        @builder.container.trigger 'xwing:pointsUpdated'
        @builder.current_squad.dirty = true
        @builder.container.trigger 'xwing-backend:squadDirtinessChanged'

    setShipType: (ship_type) ->
        @pilot_selector.data('select2').container.show()
        if ship_type != @pilot?.ship
            # Ship changed; select first non-unique
            @setPilot (exportObj.pilotsById[result.id] for result in @builder.getAvailablePilotsForShipIncluding(ship_type) when not exportObj.pilotsById[result.id].unique)[0]

        # Clear ship background class
        for cls in @row.attr('class').split(/\s+/)
            if cls.indexOf('ship-') == 0
                @row.removeClass cls

        # Show delete button
        @remove_button.fadeIn 'fast'

        # Ship background
        @row.addClass "ship-#{ship_type.toLowerCase().replace(/[^a-z0-9]/gi, '')}0"

        @builder.container.trigger 'xwing:shipUpdated'

    setPilotById: (id) ->
        @setPilot exportObj.pilotsById[parseInt id]

    setPilotByName: (name) ->
        @setPilot exportObj.pilotsByLocalizedName[$.trim name]

    setPilot: (new_pilot) ->
        if new_pilot != @pilot
            @builder.current_squad.dirty = true
            same_ship = @pilot? and new_pilot?.ship == @pilot.ship
            old_upgrades = {}
            old_titles = []
            old_modifications = []
            if same_ship
                # track addons and try to reassign them
                for upgrade in @upgrades
                    if upgrade?.data?
                        old_upgrades[upgrade.slot] ?= []
                        old_upgrades[upgrade.slot].push upgrade
                for title in @titles
                    if title?.data?
                        old_titles.push title
                for modification in @modifications
                    if modification?.data?
                        old_modifications.push modification
            @resetPilot()
            @resetAddons()
            if new_pilot?
                @data = exportObj.ships[new_pilot?.ship]
                if new_pilot?.unique?
                    await @builder.container.trigger 'xwing:claimUnique', [ new_pilot, 'Pilot', defer() ]
                @pilot = new_pilot
                @setupAddons() if @pilot?
                @copy_button.show()
                @setShipType @pilot.ship
                if same_ship
                    # Hopefully this order is correct
                    for title in @titles
                        old_title = old_titles.shift()
                        if old_title?
                            title.setById old_title.data.id
                    for modification in @modifications
                        old_modification = old_modifications.shift()
                        if old_modification?
                            modification.setById old_modification.data.id
                    for upgrade in @upgrades
                        old_upgrade = (old_upgrades[upgrade.slot] ? []).shift()
                        if old_upgrade?
                            upgrade.setById old_upgrade.data.id
            else
                @copy_button.hide()
            @builder.container.trigger 'xwing:pointsUpdated'
            @builder.container.trigger 'xwing-backend:squadDirtinessChanged'

    resetPilot: ->
        if @pilot?.unique?
            await @builder.container.trigger 'xwing:releaseUnique', [ @pilot, 'Pilot', defer() ]
        @pilot = null

    setupAddons: ->
        # Upgrades from pilot
        for slot in @pilot.slots ? []
            @upgrades.push new exportObj.Upgrade
                ship: this
                container: @addon_container
                slot: slot
        # Title
        if @pilot.ship of exportObj.titlesByShip
            @titles.push new exportObj.Title
                ship: this
                container: @addon_container
        # Modifications
        @modifications.push new exportObj.Modification
            ship: this
            container: @addon_container

    resetAddons: ->
        await
            for title in @titles
                title.destroy defer() if title?
            for upgrade in @upgrades
                upgrade.destroy defer() if upgrade?
            for modification in @modifications
                modification.destroy defer() if modification?
        @upgrades = []
        @modifications = []
        @titles = []

    getPoints: ->
        points = @pilot?.points ? 0
        for title in @titles
            points += (title?.getPoints() ? 0)
        for upgrade in @upgrades
            points += upgrade.getPoints()
        for modification in @modifications
            points += (modification?.getPoints() ? 0)
        @points_container.find('span').text points
        if points > 0
            @points_container.fadeTo 'fast', 1
        else
            @points_container.fadeTo 0, 0
        points

    getEpicPoints: ->
        @data?.epic_points ? 0

    updateSelections: ->
        if @pilot?
            @ship_selector.select2 'data',
                id: @pilot.ship
                text: @pilot.ship
                canonical_name: exportObj.ships[@pilot.ship].canonical_name
            @pilot_selector.select2 'data',
                id: @pilot.id
                text: "#{@pilot.name} (#{@pilot.points})"
            @pilot_selector.data('select2').container.show()
            for upgrade in @upgrades
                upgrade.updateSelection()
            for title in @titles
                title.updateSelection() if title?
            for modification in @modifications
                modification.updateSelection() if modification?
        else
            @pilot_selector.select2 'data', null
            @pilot_selector.data('select2').container.toggle(@ship_selector.val() != '')

    setupUI: ->
        @row = $ document.createElement 'DIV'
        @row.addClass 'row-fluid ship'
        @row.insertBefore @builder.notes_container

        @row.append $.trim '''
            <div class="span3">
                <input class="ship-selector-container" type="hidden" />
                <br />
                <input type="hidden" class="pilot-selector-container" />
            </div>
            <div class="span1 points-display-container">
                <span></span>
            </div>
            <div class="span6 addon-container" />
            <div class="span2 button-container">
                <button class="btn btn-danger remove-pilot"><span class="visible-desktop visible-tablet hidden-phone" data-toggle="tooltip" title="Remove Pilot"><i class="fa fa-times"></i></span><span class="hidden-desktop hidden-tablet visible-phone">Remove Pilot</span></button>
                <button class="btn copy-pilot"><span class="visible-desktop visible-tablet hidden-phone" data-toggle="tooltip" title="Clone Pilot"><i class="fa fa-files-o"></i></span><span class="hidden-desktop hidden-tablet visible-phone">Clone Pilot</span></button>
            </div>
        '''
        @row.find('.button-container span').tooltip()

        @ship_selector = $ @row.find('input.ship-selector-container')
        @pilot_selector = $ @row.find('input.pilot-selector-container')

        shipResultFormatter = (object, container, query) ->
            # Append directly so we don't have to disable markup escaping
            $(container).append """<i class="xwing-miniatures-ship xwing-miniatures-ship-#{object.canonical_name}"></i> #{object.text}"""
            # If you return a string, Select2 will render it
            undefined

        @ship_selector.select2
            width: '100%'
            placeholder: exportObj.translate @builder.language, 'ui', 'shipSelectorPlaceholder'
            query: (query) =>
                @builder.checkCollection()
                query.callback
                    more: false
                    results: @builder.getAvailableShipsMatching(query.term)
            minimumResultsForSearch: if $.isMobile() then -1 else 0
            formatResultCssClass: (obj) =>
                if @builder.collection?
                    not_in_collection = false
                    if @pilot? and obj.id == exportObj.ships[@pilot.ship].id
                        # Currently selected ship; mark as not in collection if it's neither
                        # on the shelf nor on the table
                        unless (@builder.collection.checkShelf('ship', obj.english_name) or @builder.collection.checkTable('pilot', obj.english_name))
                            not_in_collection = true
                    else
                        # Not currently selected; check shelf only
                        not_in_collection = not @builder.collection.checkShelf('ship', obj.english_name)
                    if not_in_collection then 'select2-result-not-in-collection' else ''
                else
                    ''
            formatResult: shipResultFormatter
            formatSelection: shipResultFormatter

        @ship_selector.on 'change', (e) =>
            @setShipType @ship_selector.val()
        # assign ship row an id for testing purposes
        @row.attr 'id', "row-#{@ship_selector.data('select2').container.attr('id')}"

        @pilot_selector.select2
            width: '100%'
            placeholder: exportObj.translate @builder.language, 'ui', 'pilotSelectorPlaceholder'
            query: (query) =>
                @builder.checkCollection()
                query.callback
                    more: false
                    results: @builder.getAvailablePilotsForShipIncluding(@ship_selector.val(), @pilot, query.term)
            minimumResultsForSearch: if $.isMobile() then -1 else 0
            formatResultCssClass: (obj) =>
                if @builder.collection?
                    not_in_collection = false
                    if obj.id == @pilot?.id
                        # Currently selected pilot; mark as not in collection if it's neither
                        # on the shelf nor on the table
                        unless (@builder.collection.checkShelf('pilot', obj.english_name) or @builder.collection.checkTable('pilot', obj.english_name))
                            not_in_collection = true
                    else
                        # Not currently selected; check shelf only
                        not_in_collection = not @builder.collection.checkShelf('pilot', obj.english_name)
                    if not_in_collection then 'select2-result-not-in-collection' else ''
                else
                    ''

        @pilot_selector.on 'change', (e) =>
            @setPilotById @pilot_selector.select2('val')
            @builder.current_squad.dirty = true
            @builder.container.trigger 'xwing-backend:squadDirtinessChanged'
            @builder.backend_status.fadeOut 'slow'
        @pilot_selector.data('select2').results.on 'mousemove-filtered', (e) =>
            select2_data = $(e.target).closest('.select2-result').data 'select2-data'
            @builder.showTooltip 'Pilot', exportObj.pilotsById[select2_data.id], {ship: @data?.english_name} if select2_data?.id?
        @pilot_selector.data('select2').container.on 'mouseover', (e) =>
            @builder.showTooltip 'Ship', this if @data?

        @pilot_selector.data('select2').container.hide()

        @points_container = $ @row.find('.points-display-container')
        @points_container.fadeTo 0, 0

        @addon_container = $ @row.find('div.addon-container')

        @remove_button = $ @row.find('button.remove-pilot')
        @remove_button.click (e) =>
            e.preventDefault()
            @row.slideUp 'fast', () =>
                @builder.removeShip this
                @backend_status?.fadeOut 'slow'
        @remove_button.hide()

        @copy_button = $ @row.find('button.copy-pilot')
        @copy_button.click (e) =>
            clone = @builder.ships[@builder.ships.length - 1]
            clone.copyFrom(this)
        @copy_button.hide()

    teardownUI: ->
        @row.text ''
        @row.remove()

    toString: ->
        if @pilot?
            "Pilot #{@pilot.name} flying #{@data.name}"
        else
            "Ship without pilot"

    toHTML: ->
        effective_stats = @effectiveStats()
        action_icons = []
        for action in effective_stats.actions
            action_icons.push switch action
                when 'Focus'
                    """<i class="xwing-miniatures-font xwing-miniatures-font-focus"></i>"""
                when 'Evade'
                    """<i class="xwing-miniatures-font xwing-miniatures-font-evade"></i>"""
                when 'Barrel Roll'
                    """<i class="xwing-miniatures-font xwing-miniatures-font-barrelroll"></i>"""
                when 'Target Lock'
                    """<i class="xwing-miniatures-font xwing-miniatures-font-targetlock"></i>"""
                when 'Boost'
                    """<i class="xwing-miniatures-font xwing-miniatures-font-boost"></i>"""
                when 'Coordinate'
                    """<i class="xwing-miniatures-font xwing-miniatures-font-coordinate"></i>"""
                when 'Jam'
                    """<i class="xwing-miniatures-font xwing-miniatures-font-jam"></i>"""
                when 'Recover'
                    """<i class="xwing-miniatures-font xwing-miniatures-font-recover"></i>"""
                when 'Reinforce'
                    """<i class="xwing-miniatures-font xwing-miniatures-font-reinforce"></i>"""
                when 'Cloak'
                    """<i class="xwing-miniatures-font xwing-miniatures-font-cloak"></i>"""
                when 'SLAM'
                    """<i class="xwing-miniatures-font xwing-miniatures-font-slam"></i>"""
                when 'Rotate Arc'
                    """<i class="xwing-miniatures-font xwing-miniatures-font-rotatearc"></i>"""
                else
                    """<span>&nbsp;#{action}<span>"""
        action_bar = action_icons.join ' '

        attack_icon = @data.attack_icon ? 'xwing-miniatures-font-attack'
        attackHTML = if (@pilot.ship_override?.attack? or @data.attack?) then $.trim """
            <i class="xwing-miniatures-font #{attack_icon}"></i>
            <span class="info-data info-attack">#{statAndEffectiveStat((@pilot.ship_override?.attack ? @data.attack), effective_stats, 'attack')}</span>
        """ else ''

        energyHTML = if (@pilot.ship_override?.energy? or @data.energy?) then $.trim """
            <i class="xwing-miniatures-font xwing-miniatures-font-energy"></i>
            <span class="info-data info-energy">#{statAndEffectiveStat((@pilot.ship_override?.energy ? @data.energy), effective_stats, 'energy')}</span>
        """ else ''

        html = $.trim """
            <div class="fancy-pilot-header">
                <div class="pilot-header-text">#{@pilot.name} <i class="xwing-miniatures-ship xwing-miniatures-ship-#{@data.canonical_name}"></i><span class="fancy-ship-type"> #{@data.name}</span></div>
                <div class="mask">
                    <div class="outer-circle">
                        <div class="inner-circle pilot-points">#{@pilot.points}</div>
                    </div>
                </div>
            </div>
            <div class="fancy-pilot-stats">
                <div class="pilot-stats-content">
                    <span class="info-data info-skill">PS #{statAndEffectiveStat(@pilot.skill, effective_stats, 'skill')}</span>
                    #{attackHTML}
                    #{energyHTML}
                    <i class="xwing-miniatures-font xwing-miniatures-font-agility"></i>
                    <span class="info-data info-agility">#{statAndEffectiveStat((@pilot.ship_override?.agility ? @data.agility), effective_stats, 'agility')}</span>
                    <i class="xwing-miniatures-font xwing-miniatures-font-hull"></i>
                    <span class="info-data info-hull">#{statAndEffectiveStat((@pilot.ship_override?.hull ? @data.hull), effective_stats, 'hull')}</span>
                    <i class="xwing-miniatures-font xwing-miniatures-font-shield"></i>
                    <span class="info-data info-shields">#{statAndEffectiveStat((@pilot.ship_override?.shields ? @data.shields), effective_stats, 'shields')}</span>
                    &nbsp;
                    #{action_bar}
                </div>
            </div>
        """

        if @pilot.text
            html += $.trim """
                <div class="fancy-pilot-text">#{@pilot.text}</div>
            """

        slotted_upgrades = (upgrade for upgrade in @upgrades when upgrade.data?)
            .concat (modification for modification in @modifications when modification.data?)
            .concat (title for title in @titles when title.data?)

        if slotted_upgrades.length > 0
            html += $.trim """
                <div class="fancy-upgrade-container">
            """

            for upgrade in slotted_upgrades
                html += upgrade.toHTML()

            html += $.trim """
                </div>
            """

        # if @getPoints() != @pilot.points
        html += $.trim """
            <div class="ship-points-total">
                <strong>Ship Total: #{@getPoints()}</strong>
            </div>
        """

        """<div class="fancy-ship">#{html}</div>"""

    toTableRow: ->
        table_html = $.trim """
            <tr class="simple-pilot">
                <td class="name">#{@pilot.name} &mdash; #{@data.name}</td>
                <td class="points">#{@pilot.points}</td>
            </tr>
        """

        slotted_upgrades = (upgrade for upgrade in @upgrades when upgrade.data?)
            .concat (modification for modification in @modifications when modification.data?)
            .concat (title for title in @titles when title.data?)
        if slotted_upgrades.length > 0
            for upgrade in slotted_upgrades
                table_html += upgrade.toTableRow()

        # if @getPoints() != @pilot.points
        table_html += """<tr class="simple-ship-total"><td colspan="2">Ship Total: #{@getPoints()}</td></tr>"""

        table_html += '<tr><td>&nbsp;</td><td></td></tr>'
        table_html

    toBBCode: ->
        bbcode = """[b]#{@pilot.name} (#{@pilot.points})[/b]"""

        slotted_upgrades = (upgrade for upgrade in @upgrades when upgrade.data?)
            .concat (modification for modification in @modifications when modification.data?)
            .concat (title for title in @titles when title.data?)
        if slotted_upgrades.length > 0
            bbcode +="\n"
            bbcode_upgrades= []
            for upgrade in slotted_upgrades
                upgrade_bbcode = upgrade.toBBCode()
                bbcode_upgrades.push upgrade_bbcode if upgrade_bbcode?
            bbcode += bbcode_upgrades.join "\n"

        bbcode

    toSimpleHTML: ->
        html = """<b>#{@pilot.name} (#{@pilot.points})</b><br />"""

        slotted_upgrades = (upgrade for upgrade in @upgrades when upgrade.data?)
            .concat (modification for modification in @modifications when modification.data?)
            .concat (title for title in @titles when title.data?)
        if slotted_upgrades.length > 0
            for upgrade in slotted_upgrades
                upgrade_html = upgrade.toSimpleHTML()
                html += upgrade_html if upgrade_html?

        html

    toSerialized: ->
        # PILOT_ID:UPGRADEID1,UPGRADEID2:TITLEID:MODIFICATIONID:CONFERREDADDONTYPE1.CONFERREDADDONID1,CONFERREDADDONTYPE2.CONFERREDADDONID2

        # Skip conferred upgrades
        conferred_addons = []
        for title in @titles
            conferred_addons = conferred_addons.concat(title?.conferredAddons ? [])
        for modification in @modifications
            conferred_addons = conferred_addons.concat(modification?.conferredAddons ? [])
        for upgrade in @upgrades
            conferred_addons = conferred_addons.concat(upgrade?.conferredAddons ? [])
        upgrades = """#{upgrade?.data?.id ? -1 for upgrade, i in @upgrades when upgrade not in conferred_addons}"""

        serialized_conferred_addons = []
        for addon in conferred_addons
            serialized_conferred_addons.push addon.toSerialized()

        [
            @pilot.id,
            upgrades,
            @titles[0]?.data?.id ? -1,
            @modifications[0]?.data?.id ? -1,
            serialized_conferred_addons.join(','),
        ].join ':'


    fromSerialized: (version, serialized) ->
        switch version
            when 1
                # PILOT_ID:UPGRADEID1,UPGRADEID2:TITLEID:TITLEUPGRADE1,TITLEUPGRADE2:MODIFICATIONID
                [ pilot_id, upgrade_ids, title_id, title_conferred_upgrade_ids, modification_id ] = serialized.split ':'

                @setPilotById parseInt(pilot_id)

                for upgrade_id, i in upgrade_ids.split ','
                    upgrade_id = parseInt upgrade_id
                    @upgrades[i].setById upgrade_id if upgrade_id >= 0

                title_id = parseInt title_id
                @titles[0].setById title_id if title_id >= 0

                if @titles[0]? and @titles[0].conferredAddons.length > 0
                    for upgrade_id, i in title_conferred_upgrade_ids.split ','
                        upgrade_id = parseInt upgrade_id
                        @titles[0].conferredAddons[i].setById upgrade_id if upgrade_id >= 0

                modification_id = parseInt modification_id
                @modifications[0].setById modification_id if modification_id >= 0

            when 2, 3
                # PILOT_ID:UPGRADEID1,UPGRADEID2:TITLEID:MODIFICATIONID:CONFERREDADDONTYPE1.CONFERREDADDONID1,CONFERREDADDONTYPE2.CONFERREDADDONID2
                [ pilot_id, upgrade_ids, title_id, modification_id, conferredaddon_pairs ] = serialized.split ':'
                @setPilotById parseInt(pilot_id)

                deferred_ids = []
                for upgrade_id, i in upgrade_ids.split ','
                    upgrade_id = parseInt upgrade_id
                    continue if upgrade_id < 0 or isNaN(upgrade_id)
                    if @upgrades[i].isOccupied()
                        deferred_ids.push upgrade_id
                    else
                        @upgrades[i].setById upgrade_id

                for deferred_id in deferred_ids
                    for upgrade, i in @upgrades
                        continue if upgrade.isOccupied() or upgrade.slot != exportObj.upgradesById[deferred_id].slot
                        upgrade.setById deferred_id
                        break


                title_id = parseInt title_id
                @titles[0].setById title_id if title_id >= 0

                modification_id = parseInt modification_id
                @modifications[0].setById modification_id if modification_id >= 0

                # We confer title addons before modification addons, to pick an arbitrary ordering.
                if conferredaddon_pairs?
                    conferredaddon_pairs = conferredaddon_pairs.split ','
                else
                    conferredaddon_pairs = []

                if @titles[0]? and @titles[0].conferredAddons.length > 0
                    title_conferred_addon_pairs = conferredaddon_pairs.splice 0, @titles[0].conferredAddons.length
                    for conferredaddon_pair, i in title_conferred_addon_pairs
                        [ addon_type_serialized, addon_id ] = conferredaddon_pair.split '.'
                        addon_id = parseInt addon_id
                        addon_cls = SERIALIZATION_CODE_TO_CLASS[addon_type_serialized]
                        conferred_addon = @titles[0].conferredAddons[i]
                        if conferred_addon instanceof addon_cls
                            conferred_addon.setById addon_id
                        else
                            throw new Error("Expected addon class #{addon_cls.constructor.name} for conferred addon at index #{i} but #{conferred_addon.constructor.name} is there")

                for modification in @modifications
                    if modification?.data? and modification.conferredAddons.length > 0
                        modification_conferred_addon_pairs = conferredaddon_pairs.splice 0, modification.conferredAddons.length
                        for conferredaddon_pair, i in modification_conferred_addon_pairs
                            [ addon_type_serialized, addon_id ] = conferredaddon_pair.split '.'
                            addon_id = parseInt addon_id
                            addon_cls = SERIALIZATION_CODE_TO_CLASS[addon_type_serialized]
                            conferred_addon = modification.conferredAddons[i]
                            if conferred_addon instanceof addon_cls
                                conferred_addon.setById addon_id
                            else
                                throw new Error("Expected addon class #{addon_cls.constructor.name} for conferred addon at index #{i} but #{conferred_addon.constructor.name} is there")

            when 4
                # PILOT_ID:UPGRADEID1,UPGRADEID2:TITLEID:MODIFICATIONID:CONFERREDADDONTYPE1.CONFERREDADDONID1,CONFERREDADDONTYPE2.CONFERREDADDONID2
                [ pilot_id, upgrade_ids, title_id, modification_id, conferredaddon_pairs ] = serialized.split ':'
                @setPilotById parseInt(pilot_id)

                deferred_ids = []
                for upgrade_id, i in upgrade_ids.split ','
                    upgrade_id = parseInt upgrade_id
                    continue if upgrade_id < 0 or isNaN(upgrade_id)
                    # Defer fat upgrades
                    if @upgrades[i].isOccupied() or @upgrades[i].dataById[upgrade_id].also_occupies_upgrades?
                        deferred_ids.push upgrade_id
                    else
                        @upgrades[i].setById upgrade_id

                for deferred_id in deferred_ids
                    for upgrade, i in @upgrades
                        continue if upgrade.isOccupied() or upgrade.slot != exportObj.upgradesById[deferred_id].slot
                        upgrade.setById deferred_id
                        break


                title_id = parseInt title_id
                @titles[0].setById title_id if title_id >= 0

                modification_id = parseInt modification_id
                @modifications[0].setById modification_id if modification_id >= 0

                # We confer title addons before modification addons, to pick an arbitrary ordering.
                if conferredaddon_pairs?
                    conferredaddon_pairs = conferredaddon_pairs.split ','
                else
                    conferredaddon_pairs = []

                for title, i in @titles
                    if title?.data? and title.conferredAddons.length > 0
                        # console.log "Confer title #{title.data.name} at #{i}"
                        title_conferred_addon_pairs = conferredaddon_pairs.splice 0, title.conferredAddons.length
                        for conferredaddon_pair, i in title_conferred_addon_pairs
                            [ addon_type_serialized, addon_id ] = conferredaddon_pair.split '.'
                            addon_id = parseInt addon_id
                            addon_cls = SERIALIZATION_CODE_TO_CLASS[addon_type_serialized]
                            conferred_addon = title.conferredAddons[i]
                            if conferred_addon instanceof addon_cls
                                conferred_addon.setById addon_id
                            else
                                throw new Error("Expected addon class #{addon_cls.constructor.name} for conferred addon at index #{i} but #{conferred_addon.constructor.name} is there")

                for modification in @modifications
                    if modification?.data? and modification.conferredAddons.length > 0
                        modification_conferred_addon_pairs = conferredaddon_pairs.splice 0, modification.conferredAddons.length
                        for conferredaddon_pair, i in modification_conferred_addon_pairs
                            [ addon_type_serialized, addon_id ] = conferredaddon_pair.split '.'
                            addon_id = parseInt addon_id
                            addon_cls = SERIALIZATION_CODE_TO_CLASS[addon_type_serialized]
                            conferred_addon = modification.conferredAddons[i]
                            if conferred_addon instanceof addon_cls
                                conferred_addon.setById addon_id
                            else
                                throw new Error("Expected addon class #{addon_cls.constructor.name} for conferred addon at index #{i} but #{conferred_addon.constructor.name} is there")


                for upgrade in @upgrades
                    if upgrade?.data? and upgrade.conferredAddons.length > 0
                        upgrade_conferred_addon_pairs = conferredaddon_pairs.splice 0, upgrade.conferredAddons.length
                        for conferredaddon_pair, i in upgrade_conferred_addon_pairs
                            [ addon_type_serialized, addon_id ] = conferredaddon_pair.split '.'
                            addon_id = parseInt addon_id
                            addon_cls = SERIALIZATION_CODE_TO_CLASS[addon_type_serialized]
                            conferred_addon = upgrade.conferredAddons[i]
                            if conferred_addon instanceof addon_cls
                                conferred_addon.setById addon_id
                            else
                                throw new Error("Expected addon class #{addon_cls.constructor.name} for conferred addon at index #{i} but #{conferred_addon.constructor.name} is there")

        @updateSelections()

    effectiveStats: ->
        stats =
            skill: @pilot.skill
            attack: @pilot.ship_override?.attack ? @data.attack
            energy: @pilot.ship_override?.energy ? @data.energy
            agility: @pilot.ship_override?.agility ? @data.agility
            hull: @pilot.ship_override?.hull ? @data.hull
            shields: @pilot.ship_override?.shields ? @data.shields
            actions: (@pilot.ship_override?.actions ? @data.actions).slice 0

        # need a deep copy of maneuvers array
        stats.maneuvers = []
        for s in [0 ... (@data.maneuvers ? []).length]
            stats.maneuvers[s] = @data.maneuvers[s].slice 0

        for upgrade in @upgrades
            upgrade.data.modifier_func(stats) if upgrade?.data?.modifier_func?
        for title in @titles
            title.data.modifier_func(stats) if title?.data?.modifier_func?
        for modification in @modifications
            modification.data.modifier_func(stats) if modification?.data?.modifier_func?
        @pilot.modifier_func(stats) if @pilot?.modifier_func?
        stats

    validate: ->
        # Remove addons that violate their validation functions (if any) one by one
        # until everything checks out
        # If there is no explicit validation_func, use restriction_func
        max_checks = 128 # that's a lot of addons (Epic?)
        for i in [0...max_checks]
            valid = true
            for upgrade in @upgrades
                func = upgrade?.data?.validation_func ? upgrade?.data?.restriction_func ? undefined
                if func? and not func(this, upgrade)
                    #console.log "Invalid upgrade: #{upgrade?.data?.name}"
                    upgrade.setById null
                    valid = false
                    break

            for title in @titles
                func = title?.data?.validation_func ? title?.data?.restriction_func ? undefined
                if func? and not func this
                    #console.log "Invalid title: #{title?.data?.name}"
                    title.setById null
                    valid = false
                    break

            for modification in @modifications
                func = modification?.data?.validation_func ? modification?.data?.restriction_func ? undefined
                if func? and not func(this, modification)
                    #console.log "Invalid modification: #{modification?.data?.name}"
                    modification.setById null
                    valid = false
                    break
            break if valid
        @updateSelections()

    checkUnreleasedContent: ->
        if @pilot? and not exportObj.isReleased @pilot
            #console.log "#{@pilot.name} is unreleased"
            return true

        for title in @titles
            if title?.data? and not exportObj.isReleased title.data
                #console.log "#{title.data.name} is unreleased"
                return true

        for modification in @modifications
            if modification?.data? and not exportObj.isReleased modification.data
                #console.log "#{modification.data.name} is unreleased"
                return true

        for upgrade in @upgrades
            if upgrade?.data? and not exportObj.isReleased upgrade.data
                #console.log "#{upgrade.data.name} is unreleased"
                return true

        false

    checkEpicContent: ->
        if @pilot? and @pilot.epic?
            return true

        for title in @titles
            if title?.data?.epic?
                return true

        for modification in @modifications
            if modification?.data?.epic?
                return true

        for upgrade in @upgrades
            if upgrade?.data?.epic?
                return true

        false

    hasAnotherUnoccupiedSlotLike: (upgrade_obj) ->
        for upgrade in @upgrades
            continue if upgrade == upgrade_obj or upgrade.slot != upgrade_obj.slot
            return true unless upgrade.isOccupied()
        false

    toXWS: ->
        xws =
            name: @pilot.canonical_name
            points: @getPoints()
            ship: @data.canonical_name

        if @data.multisection
            xws.multisection = @data.multisection.slice 0

        upgrade_obj = {}

        for upgrade in @upgrades
            if upgrade?.data?
                upgrade.toXWS upgrade_obj

        for modification in @modifications
            if modification?.data?
                modification.toXWS upgrade_obj

        for title in @titles
            if title?.data?
                title.toXWS upgrade_obj

        if Object.keys(upgrade_obj).length > 0
            xws.upgrades = upgrade_obj

        xws

    getConditions: ->
        if Set?
            conditions = new Set()
            if @pilot?.applies_condition?
                if @pilot.applies_condition instanceof Array
                    for condition in @pilot.applies_condition
                        conditions.add(exportObj.conditionsByCanonicalName[condition])
                else
                    conditions.add(exportObj.conditionsByCanonicalName[@pilot.applies_condition])
            for upgrade in @upgrades
                if upgrade?.data?.applies_condition?
                    if upgrade.data.applies_condition instanceof Array
                        for condition in upgrade.data.applies_condition
                            conditions.add(exportObj.conditionsByCanonicalName[condition])
                    else
                        conditions.add(exportObj.conditionsByCanonicalName[upgrade.data.applies_condition])
            conditions
        else
            console.warn 'Set not supported in this JS implementation, not implementing conditions'
            []

class GenericAddon
    constructor: (args) ->
        # args
        @ship = args.ship
        @container = $ args.container

        # internal state
        @data = null
        @unadjusted_data = null
        @conferredAddons = []
        @serialization_code = 'X'
        @occupied_by = null
        @occupying = []
        @destroyed = false

        # Overridden by children
        @type = null
        @dataByName = null
        @dataById = null

        @adjustment_func = args.adjustment_func if args.adjustment_func?
        @filter_func = args.filter_func if args.filter_func?
        @placeholderMod_func = if args.placeholderMod_func? then args.placeholderMod_func else (x) => x

    destroy: (cb, args...) ->
        return cb(args) if @destroyed
        if @data?.unique?
            await @ship.builder.container.trigger 'xwing:releaseUnique', [ @data, @type, defer() ]
        @destroyed = true
        @rescindAddons()
        @deoccupyOtherUpgrades()
        @selector.select2 'destroy'
        cb args

    setupSelector: (args) ->
        @selector = $ document.createElement 'INPUT'
        @selector.attr 'type', 'hidden'
        @container.append @selector
        args.minimumResultsForSearch = -1 if $.isMobile()
        args.formatResultCssClass = (obj) =>
            if @ship.builder.collection?
                not_in_collection = false
                if obj.id == @data?.id
                    # Currently selected card; mark as not in collection if it's neither
                    # on the shelf nor on the table
                    unless (@ship.builder.collection.checkShelf(@type.toLowerCase(), obj.english_name) or @ship.builder.collection.checkTable(@type.toLowerCase(), obj.english_name))
                        not_in_collection = true
                else
                    # Not currently selected; check shelf only
                    not_in_collection = not @ship.builder.collection.checkShelf(@type.toLowerCase(), obj.english_name)
                if not_in_collection then 'select2-result-not-in-collection' else ''
            else
                ''
        args.formatSelection = (obj, container) =>
            icon = switch @type
                when 'Upgrade'
                    @slot.toLowerCase().replace(/[^0-9a-z]/gi, '')
                else
                    @type.toLowerCase().replace(/[^0-9a-z]/gi, '')

            # Append directly so we don't have to disable markup escaping
            $(container).append """<i class="xwing-miniatures-font xwing-miniatures-font-#{icon}"></i> #{obj.text}"""
            # If you return a string, Select2 will render it
            undefined

        @selector.select2 args
        @selector.on 'change', (e) =>
            @setById @selector.select2('val')
            @ship.builder.current_squad.dirty = true
            @ship.builder.container.trigger 'xwing-backend:squadDirtinessChanged'
            @ship.builder.backend_status.fadeOut 'slow'
        @selector.data('select2').results.on 'mousemove-filtered', (e) =>
            select2_data = $(e.target).closest('.select2-result').data 'select2-data'
            @ship.builder.showTooltip 'Addon', @dataById[select2_data.id], {addon_type: @type} if select2_data?.id?
        @selector.data('select2').container.on 'mouseover', (e) =>
            @ship.builder.showTooltip 'Addon', @data, {addon_type: @type} if @data?

    setById: (id) ->
        @setData @dataById[parseInt id]

    setByName: (name) ->
        @setData @dataByName[$.trim name]

    setData: (new_data) ->
        if new_data?.id != @data?.id
            if @data?.unique?
                await @ship.builder.container.trigger 'xwing:releaseUnique', [ @unadjusted_data, @type, defer() ]
            @rescindAddons()
            @deoccupyOtherUpgrades()
            if new_data?.unique?
                await @ship.builder.container.trigger 'xwing:claimUnique', [ new_data, @type, defer() ]
            # Need to make a copy of the data, but that means I can't just check equality
            @data = @unadjusted_data = new_data

            if @data?
                if @data.superseded_by_id
                    return @setById @data.superseded_by_id
                if @adjustment_func?
                    @data = @adjustment_func(@data)
                @unequipOtherUpgrades()
                @occupyOtherUpgrades()
                @conferAddons()
            else
                @deoccupyOtherUpgrades()

            @ship.builder.container.trigger 'xwing:pointsUpdated'

    conferAddons: ->
        if @data.confersAddons? and @data.confersAddons.length > 0
            for addon in @data.confersAddons
                cls = addon.type
                args =
                    ship: @ship
                    container: @container
                args.slot = addon.slot if addon.slot?
                args.adjustment_func = addon.adjustment_func if addon.adjustment_func?
                args.filter_func = addon.filter_func if addon.filter_func?
                args.auto_equip = addon.auto_equip if addon.auto_equip?
                args.placeholderMod_func = addon.placeholderMod_func if addon.placeholderMod_func?
                addon = new cls args
                if addon instanceof exportObj.Upgrade
                    @ship.upgrades.push addon
                else if addon instanceof exportObj.Modification
                    @ship.modifications.push addon
                else if addon instanceof exportObj.Title
                    @ship.titles.push addon
                else
                    throw new Error("Unexpected addon type for addon #{addon}")
                @conferredAddons.push addon

    rescindAddons: ->
        await
            for addon in @conferredAddons
                addon.destroy defer()
        for addon in @conferredAddons
            if addon instanceof exportObj.Upgrade
                @ship.upgrades.removeItem addon
            else if addon instanceof exportObj.Modification
                @ship.modifications.removeItem addon
            else if addon instanceof exportObj.Title
                @ship.titles.removeItem addon
            else
                throw new Error("Unexpected addon type for addon #{addon}")
        @conferredAddons = []

    getPoints: ->
        # Moar special case jankiness
        if 'vaksai' in (title.data?.canonical_name for title in @ship?.titles ? []) and @data?.canonical_name != 'vaksai'
            Math.max(0, (@data?.points ? 0) - 1)
        else
            @data?.points ? 0

    updateSelection: ->
        if @data?
            @selector.select2 'data',
                id: @data.id
                text: "#{@data.name} (#{@data.points})"
        else
            @selector.select2 'data', null

    toString: ->
        if @data?
            "#{@data.name} (#{@data.points})"
        else
            "No #{@type}"

    toHTML: ->
        if @data?
            upgrade_slot_font = (@data.slot ? @type).toLowerCase().replace(/[^0-9a-z]/gi, '')

            match_array = @data.text.match(/(<span.*<\/span>)<br \/><br \/>(.*)/)

            if match_array
                restriction_html = '<div class="card-restriction-container">' + match_array[1] + '</div>'
                text_str = match_array[2]
            else
                restriction_html = ''
                text_str = @data.text

            attackHTML = if (@data.attack?) then $.trim """
                <div class="upgrade-attack">
                    <span class="upgrade-attack-range">#{@data.range}</span>
                    <span class="info-data info-attack">#{@data.attack}</span>
                    <i class="xwing-miniatures-font xwing-miniatures-font-attack"></i>
                </div>
            """ else ''

            energyHTML = if (@data.energy?) then $.trim """
                <div class="upgrade-energy">
                    <span class="info-data info-energy">#{@data.energy}</span>
                    <i class="xwing-miniatures-font xwing-miniatures-font-energy"></i>
                </div>
            """ else ''

            $.trim """
                <div class="upgrade-container">
                    <div class="upgrade-stats">
                        <div class="upgrade-name"><i class="xwing-miniatures-font xwing-miniatures-font-#{upgrade_slot_font}"></i>#{@data.name}</div>
                        <div class="mask">
                            <div class="outer-circle">
                                <div class="inner-circle upgrade-points">#{@data.points}</div>
                            </div>
                        </div>
                        #{restriction_html}
                    </div>
                    #{attackHTML}
                    #{energyHTML}
                    <div class="upgrade-text">#{text_str}</div>
                    <div style="clear: both;"></div>
                </div>
            """
        else
            ''

    toTableRow: ->
        if @data?
            $.trim """
                <tr class="simple-addon">
                    <td class="name">#{@data.name}</td>
                    <td class="points">#{@data.points}</td>
                </tr>
            """
        else
            ''

    toBBCode: ->
        if @data?
            """[i]#{@data.name} (#{@data.points})[/i]"""
        else
            null

    toSimpleHTML: ->
        if @data?
            """<i>#{@data.name} (#{@data.points})</i><br />"""
        else
            ''

    toSerialized: ->
        """#{@serialization_code}.#{@data?.id ? -1}"""

    unequipOtherUpgrades: ->
        for slot in @data?.unequips_upgrades ? []
            for upgrade in @ship.upgrades
                continue if upgrade.slot != slot or upgrade == this or not upgrade.isOccupied()
                upgrade.setData null
                break
        if @data?.unequips_modifications
            for modification in @ship.modifications
                continue unless modification == this or modification.isOccupied()
                modification.setData null

    isOccupied: ->
        @data? or @occupied_by?

    occupyOtherUpgrades: ->
        for slot in @data?.also_occupies_upgrades ? []
            for upgrade in @ship.upgrades
                continue if upgrade.slot != slot or upgrade == this or upgrade.isOccupied()
                @occupy upgrade
                break
        if @data?.also_occupies_modifications
            for modification in @ship.modifications
                continue if modification == this or modification.isOccupied()
                @occupy modification

    deoccupyOtherUpgrades: ->
        for upgrade in @occupying
            @deoccupy upgrade

    occupy: (upgrade) ->
        upgrade.occupied_by = this
        upgrade.selector.select2 'enable', false
        @occupying.push upgrade

    deoccupy: (upgrade) ->
        upgrade.occupied_by = null
        upgrade.selector.select2 'enable', true

    occupiesAnotherUpgradeSlot: ->
        for upgrade in @ship.upgrades
            continue if upgrade.slot != @slot or upgrade == this or upgrade.data?
            if upgrade.occupied_by? and upgrade.occupied_by == this
                return true
        false

    toXWS: (upgrade_dict) ->
        upgrade_type = switch @type
            when 'Upgrade'
                exportObj.toXWSUpgrade[@slot] ? @slot.canonicalize()
            else
                exportObj.toXWSUpgrade[@type] ?  @type.canonicalize()
        (upgrade_dict[upgrade_type] ?= []).push @data.canonical_name

class exportObj.Upgrade extends GenericAddon
    constructor: (args) ->
        # args
        super args
        @slot = args.slot
        @type = 'Upgrade'
        @dataById = exportObj.upgradesById
        @dataByName = exportObj.upgradesByLocalizedName
        @serialization_code = 'U'

        @setupSelector()

    setupSelector: ->
        super
            width: '50%'
            placeholder: @placeholderMod_func(exportObj.translate @ship.builder.language, 'ui', 'upgradePlaceholder', @slot)
            allowClear: true
            query: (query) =>
                @ship.builder.checkCollection()
                query.callback
                    more: false
                    results: @ship.builder.getAvailableUpgradesIncluding(@slot, @data, @ship, this, query.term, @filter_func)

class exportObj.Modification extends GenericAddon
    constructor: (args) ->
        super args
        @type = 'Modification'
        @dataById = exportObj.modificationsById
        @dataByName = exportObj.modificationsByLocalizedName
        @serialization_code = 'M'

        @setupSelector()

    setupSelector: ->
        super
            width: '50%'
            placeholder: @placeholderMod_func(exportObj.translate @ship.builder.language, 'ui', 'modificationPlaceholder')
            allowClear: true
            query: (query) =>
                @ship.builder.checkCollection()
                query.callback
                    more: false
                    results: @ship.builder.getAvailableModificationsIncluding(@data, @ship, query.term, @filter_func)

class exportObj.Title extends GenericAddon
    constructor: (args) ->
        super args
        @type = 'Title'
        @dataById = exportObj.titlesById
        @dataByName = exportObj.titlesByLocalizedName
        @serialization_code = 'T'

        @setupSelector()

    setupSelector: ->
        super
            width: '50%'
            placeholder: @placeholderMod_func(exportObj.translate @ship.builder.language, 'ui', 'titlePlaceholder')
            allowClear: true
            query: (query) =>
                @ship.builder.checkCollection()
                query.callback
                    more: false
                    results: @ship.builder.getAvailableTitlesIncluding(@ship, @data, query.term)

class exportObj.RestrictedUpgrade extends exportObj.Upgrade
    constructor: (args) ->
        @filter_func = args.filter_func
        super args
        @serialization_code = 'u'
        if args.auto_equip?
            @setById args.auto_equip

class exportObj.RestrictedModification extends exportObj.Modification
    constructor: (args) ->
        @filter_func = args.filter_func
        super args
        @serialization_code = 'm'
        if args.auto_equip?
            @setById args.auto_equip

SERIALIZATION_CODE_TO_CLASS =
    'M': exportObj.Modification
    'T': exportObj.Title
    'U': exportObj.Upgrade
    'u': exportObj.RestrictedUpgrade
    'm': exportObj.RestrictedModification

exportObj = exports ? this

exportObj.fromXWSFaction =
    'rebel': 'Rebel Alliance'
    'rebels': 'Rebel Alliance'
    'empire': 'Galactic Empire'
    'imperial': 'Galactic Empire'
    'scum': 'Scum and Villainy'

exportObj.toXWSFaction =
    'Rebel Alliance': 'rebel'
    'Galactic Empire': 'imperial'
    'Scum and Villainy': 'scum'

exportObj.toXWSUpgrade =
    'Astromech': 'amd'
    'Elite': 'ept'
    'Modification': 'mod'
    'Salvaged Astromech': 'samd'

exportObj.fromXWSUpgrade =
    'amd': 'Astromech'
    'astromechdroid': 'Astromech'
    'ept': 'Elite'
    'elitepilottalent': 'Elite'
    'mod': 'Modification'
    'samd': 'Salvaged Astromech'

SPEC_URL = 'https://github.com/elistevens/xws-spec'

class exportObj.XWSManager
    constructor: (args) ->
        @container = $ args.container

        @setupUI()
        @setupHandlers()

    setupUI: ->
        @container.addClass 'hidden-print'
        @container.html $.trim """
            <div class="row-fluid">
                <div class="span9">
                </div>
            </div>
        """

        @xws_export_modal = $ document.createElement 'DIV'
        @xws_export_modal.addClass 'modal hide fade xws-modal hidden-print'
        @container.append @xws_export_modal
        @xws_export_modal.append $.trim """
            <div class="modal-header">
                <button type="button" class="close hidden-print" data-dismiss="modal" aria-hidden="true">&times;</button>
                <h3>XWS Export (Beta!)</h3>
            </div>
            <div class="modal-body">
                <ul class="nav nav-pills">
                    <li><a id="xws-text-tab" href="#xws-text" data-toggle="tab">Text</a></li>
                    <li><a id="xws-qrcode-tab" href="#xws-qrcode" data-toggle="tab">QR Code</a></li>
                </ul>
                <div class="tab-content">
                    <div class="tab-pane" id="xws-text">
                        Copy and paste this into an XWS-compliant application to transfer your list.
                        <i>(This is in beta, and the <a href="#{SPEC_URL}">spec</a> is still being defined, so it may not work!)</i>
                        <div class="container-fluid">
                            <textarea class="xws-content"></textarea>
                        </div>
                    </div>
                    <div class="tab-pane" id="xws-qrcode">
                        Below is a QR Code of XWS.  <i>This is still very experimental!</i>
                        <div id="xws-qrcode-container"></div>
                    </div>
                </div>
            </div>
            <div class="modal-footer hidden-print">
                <button class="btn" data-dismiss="modal" aria-hidden="true">Close</button>
            </div>
        """

        @xws_import_modal = $ document.createElement 'DIV'
        @xws_import_modal.addClass 'modal hide fade xws-modal hidden-print'
        @container.append @xws_import_modal
        @xws_import_modal.append $.trim """
            <div class="modal-header">
                <button type="button" class="close hidden-print" data-dismiss="modal" aria-hidden="true">&times;</button>
                <h3>XWS Import (Beta!)</h3>
            </div>
            <div class="modal-body">
                Paste XWS here to load a list exported from another application.
                <i>(This is in beta, and the <a href="#{SPEC_URL}">spec</a> is still being defined, so it may not work!)</i>
                <div class="container-fluid">
                    <textarea class="xws-content" placeholder="Paste XWS here..."></textarea>
                </div>
            </div>
            <div class="modal-footer hidden-print">
                <span class="xws-import-status"></span>&nbsp;
                <button class="btn btn-primary import-xws">Import It!</button>
                <button class="btn" data-dismiss="modal" aria-hidden="true">Close</button>
            </div>
        """

    setupHandlers: ->
        @from_xws_button = @container.find('button.from-xws')
        @from_xws_button.click (e) =>
            e.preventDefault()
            @xws_import_modal.modal 'show'

        @to_xws_button = @container.find('button.to-xws')
        @to_xws_button.click (e) =>
            e.preventDefault()
            $(window).trigger 'xwing:pingActiveBuilder', (builder) =>
                textarea = $ @xws_export_modal.find('.xws-content')
                textarea.attr 'readonly'
                textarea.val JSON.stringify(builder.toXWS())
                $('#xws-qrcode-container').text ''
                $('#xws-qrcode-container').qrcode
                    render: 'canvas'
                    text: JSON.stringify(builder.toMinimalXWS())
                    ec: 'L'
                    size: 256
                @xws_export_modal.modal 'show'
                $('#xws-text-tab').tab 'show'
                textarea.select()
                textarea.focus()

        $('#xws-qrcode-container').click (e) ->
            window.open $('#xws-qrcode-container canvas')[0].toDataURL()

        @load_xws_button = $ @xws_import_modal.find('button.import-xws')
        @load_xws_button.click (e) =>
            e.preventDefault()
            import_status = $ @xws_import_modal.find('.xws-import-status')
            import_status.text 'Loading...'
            do (import_status) =>
                try
                    xws = JSON.parse @xws_import_modal.find('.xws-content').val()
                catch e
                    import_status.text 'Invalid JSON'
                    return

                do (xws) =>
                    $(window).trigger 'xwing:activateBuilder', [exportObj.fromXWSFaction[xws.faction], (builder) =>
                        if builder.current_squad.dirty and builder.backend?
                            @xws_import_modal.modal 'hide'
                            builder.backend.warnUnsaved builder, =>
                                builder.loadFromXWS xws, (res) =>
                                    unless res.success
                                        @xws_import_modal.modal 'show'
                                        import_status.text res.error
                        else
                            builder.loadFromXWS xws, (res) =>
                                if res.success
                                    @xws_import_modal.modal 'hide'
                                else
                                    import_status.text res.error
                    ]
