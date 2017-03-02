getProfileData(function(data){
    /* ensure we're on a profile page, this content script is loaded on every page because
     there is no default url that indicates a profile page */
    if(!data || !data.url || !data.steamid) return;

    doInjections()

    /* replaces background (if they don't have one) and the texture with a nice gradient */
    $('.profile_header_bg_texture, .no_header.profile_page:not(.has_profile_background)').css('background', 'url("http://store.akamai.steamstatic.com/public/images/v6/colored_body_top.png?v=2") center top no-repeat #1b2838')

    /* set a box shadow around their profile picture */
    $('.playerAvatar.profile_header_size').css('box-shadow', '0px 0px 15px -3px black')

    checkVerification(data.steamid, function(response){
        if(response.success && response.verified){
            /* if the user is a marked scammer or impersonator, set their profile header background
             to have a red background */
            if(response.scammer){
                $('.profile_header_bg_texture, .no_header.profile_page:not(.has_profile_background)').css('background', 'rgb(101, 18, 32)')
                $('.profile_header_bg_texture, .no_header.profile_page:not(.has_profile_background)').css('background', 'rgb(101, 18, 32)')
                $('.playerAvatar.profile_header_size').css('background', 'red')
            }

            $('.profile_header_content').before('<div class="st-verified-profile ' + (response.scammer ? 'st-verified-scammer' : '') + '">' + response.name + '</div>')
        }
    })

    /* TODO: add a SteamRep check here in the future */
})

function getProfileData(callback){
    injectScriptWithEvent(null, function(){
        window.dispatchEvent(new CustomEvent('%%event%%', {
            detail: typeof(g_rgProfileData) != 'undefined' ? g_rgProfileData : null
        }));
    }, callback)
}

function doInjections(){
    injectScriptWithEvent(null, function(){
        /* if this variable has no property, it means either due to privacy settings or the state of the account
         that people are unable to comment and therefore we cannot gain access to the m_cUpVotes, m_bLoadingUserHasUpVoted
         data - I could track upvotes via my server, but Steam handles vote manipulation for us (login sessions) */
        if(Object.keys(g_rgCommentThreads).length == 0) return;

        getUpVotes()
        function getUpVotes(){
            if(typeof(g_rgCommentThreads) == 'undefined') return setTimeout(getUpVotes, 50)
            window.dispatchEvent(new CustomEvent('%%event%%', {
                detail: {
                    upvotes: g_rgCommentThreads[Object.keys(g_rgCommentThreads)[0]].m_cUpVotes.toLocaleString(),
                    upvoted: g_rgCommentThreads[Object.keys(g_rgCommentThreads)[0]].m_bLoadingUserHasUpVoted
                }
            }));
        }

        window.upvoteUser = function(){
            shouldScroll = false;
            g_rgCommentThreads[Object.keys(g_rgCommentThreads)[0]].VoteUp()
        }
    }, function(detail){
        /* here we add the upvote box to the profile */
        $('.profile_header_badgeinfo').append(
            '<div onclick="upvoteUser()" class="persona_name st-upvote-box" data-community-tooltip="CS:GO Trade Helper<br>Click the thumbs up icon to upvote this profile!">' +
            '<span ' + (detail.upvoted ? 'class="active"' : '') + ' id="st-upvote">' +
            '<i class="ico16 thumb_up"></i>' +
            '</span>' +
            '<span id="st-upvotes">' + detail.upvotes + '</span>' +
            '</div>'
        )

        /* and now we need to intialise the tool tip we just inserted */
        injectScript({}, function(){
            BindCommunityTooltip( $J('[data-community-tooltip]') );
        })
    })

    injectScript({ '%%pageSize%%': 15 }, function(){
        /* if this variable has no property, it means due to privacy settings or the state of the account
         that people are unable to comment and therefore we cannot access the variables we need */
        if(Object.keys(g_rgCommentThreads).length == 0) return;

        g_rgCommentThreads[Object.keys(g_rgCommentThreads)[0]].m_cPageSize = '%%pageSize%%';
        /* iCurrentPage is 0 when the page loads, to reload the comments we need to set it
         to -1 (GoToPage will return if iCurrentPage == pageToGoTo) and then go to page 0 */
        g_rgCommentThreads[Object.keys(g_rgCommentThreads)[0]].m_iCurrentPage = -1;

        /* when we call GoToPage(0) after delcaring this function (to reload the comments with the number
         of comments we want) it will scroll down to the bottom, to stop this we redefine the function
         and set a shouldScroll variable */
        var shouldScroll = false;
        ScrollToIfNotInView = function(elem, nRequiredPixelsToShow, nSpacingBefore, nAnimationSpeed){
            if(!shouldScroll) return shouldScroll = true;

            var $Elem = $JFromIDOrElement(elem);

            if(typeof(nSpacingBefore) == 'undefined') nSpacingBefore = 0;

            // for responsive pages - we need to adjust for the menu
            nSpacingBefore += GetResponsiveHeaderFixedOffsetAdjustment();

            var elemTop = $Elem.offset().top;
            var nViewportOffsetTop = elemTop - $J(window).scrollTop();
            var bNeedToScroll = false;
            if(nViewportOffsetTop < 0){
                bNeedToScroll = true;
            } else {
                if(!nRequiredPixelsToShow) nRequiredPixelsToShow = $Elem.outerHeight();
                var nViewportOffsetBottom = nViewportOffsetTop + nRequiredPixelsToShow;
                if(nViewportOffsetBottom > $J(window).height()) bNeedToScroll = true;
            }

            if(bNeedToScroll){
                if(nSpacingBefore) nViewportOffsetTop -= nSpacingBefore;
                if(typeof(nAnimationSpeed) != 'undefined'){
                    $J('html, body').animate({scrollTop: nViewportOffsetTop}, nAnimationSpeed);
                } else {
                    window.scrollBy( 0, nViewportOffsetTop );
                }
            }
        }

        g_rgCommentThreads[Object.keys(g_rgCommentThreads)[0]].GoToPage(0);

        /* rewrite upvote response function to change vote colour */
        g_rgCommentThreads[Object.keys(g_rgCommentThreads)[0]].OnResponseVoteUp = function(nAjaxSequenceNumber, transport){
            if(transport.responseJSON && transport.responseJSON.success){
                //this.m_bLoadingUserHasUpVoted = !this.m_bLoadingUserHasUpVoted;	// we can switch this to getting from the response after 8/24/2012
                this.m_bLoadingUserHasUpVoted = transport.responseJSON.has_upvoted; // the above line is a comment left by a Steam engineer :), I've used the response
                this.m_cUpVotes = transport.responseJSON.upvotes;

                if(this.m_bLoadingUserHasUpVoted){
                    $('st-upvote').addClassName('active');
                } else {
                    $('st-upvote').removeClassName('active');
                }

                $('st-upvotes').innerText = transport.responseJSON.upvotes;
            } else {
                this.OnFailureDisplayError(transport);
            }
        }
    })

}